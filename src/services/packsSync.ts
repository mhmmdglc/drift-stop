import { supabase } from '@/lib/supabase';
import { upsertPacks, type RemotePack } from '@/db/packsCache';

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
export async function syncPacks(): Promise<{ synced: number }> {
  if (!supabase) return { synced: 0 };

  try {
    const { data, error } = await supabase
      .from('quote_packs')
      .select('id, name, description, cover_image_url, is_premium, sort_order, quote_count')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) return { synced: 0 };

    upsertPacks((data as PackRow[]).map(toRemotePack));
    return { synced: data.length };
  } catch {
    return { synced: 0 };
  }
}
