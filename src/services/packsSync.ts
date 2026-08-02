import { supabase } from '@/lib/supabase';
import { deletePacksNotIn, upsertPacks, type RemotePack } from '@/db/packsCache';

type PackRow = {
  id: string;
  name: Record<string, string>;
  description: Record<string, string> | null;
  cover_image_url: string | null;
  is_premium: boolean;
  sort_order: number;
  quote_count: number;
};

function toRemotePack(row: PackRow): RemotePack {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    coverImageUrl: row.cover_image_url,
    isPremium: row.is_premium,
    sortOrder: row.sort_order,
    quoteCount: row.quote_count,
  };
}

/**
 * `quote_packs` tablosunun tamamını çekip yerel cache'e yazar. Tablo küçük
 * olduğu için (birkaç düzine paket) delta sync yerine tam upsert yeterli.
 * Ağ yoksa / Supabase yapılandırılmamışsa sessizce hiçbir şey yapmaz —
 * paketler ekranı boş liste gösterir, uygulama çökmemeli.
 */
export async function syncPacks(): Promise<{ synced: number; removed?: number }> {
  if (!supabase) return { synced: 0 };

  try {
    const { data, error } = await supabase
      .from('quote_packs')
      .select('id, name, description, cover_image_url, is_premium, sort_order, quote_count')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) return { synced: 0 };

    const rows = (data as PackRow[]).map(toRemotePack);
    upsertPacks(rows);
    // Silme yayılımı: bu çekim paketlerin tamamını getiriyor, dolayısıyla listede
    // olmayan yerel paket yayından kaldırılmıştır. Boş/hatalı cevap buraya hiç
    // ulaşmıyor (yukarıda erken dönülüyor), yani toplu silme mümkün değil.
    const removed = deletePacksNotIn(rows.map((r) => r.id));
    return { synced: data.length, removed };
  } catch {
    return { synced: 0 };
  }
}
