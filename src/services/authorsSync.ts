import { supabase } from '@/lib/supabase';
import { upsertPremiumAuthorCounts } from '@/db/packsCache';

type AuthorCountRow = { author: string; quote_count: number };

/**
 * Premium sözlerdeki tüm yazarların adı + söz sayısını çeker (RLS'i atlayan
 * `get_premium_author_counts` RPC'si — bkz. migration 0003). Bu, herkese açık
 * metadata (paket adı/açıklaması gibi) — sözlerin METNİ hâlâ entitlement'a
 * bağlı kalır. Free/guest kullanıcılar bu sayede "Yazarlar" bölümünü
 * (kilitli haliyle) görebilir, sadece Pro'da içeriğin kendisi açılır.
 * Ağ yoksa / Supabase yapılandırılmamışsa sessizce hiçbir şey yapmaz.
 */
export async function syncAuthorCounts(): Promise<{ synced: number }> {
  if (!supabase) return { synced: 0 };

  try {
    const { data, error } = await supabase.rpc('get_premium_author_counts');
    if (error) throw error;
    if (!data || (data as AuthorCountRow[]).length === 0) return { synced: 0 };

    const rows = (data as AuthorCountRow[]).map((r) => ({
      author: r.author,
      quoteCount: r.quote_count,
    }));
    upsertPremiumAuthorCounts(rows);
    return { synced: rows.length };
  } catch {
    return { synced: 0 };
  }
}
