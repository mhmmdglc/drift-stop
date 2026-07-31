import { supabase } from '@/lib/supabase';
import { getLastSyncAt, setLastSyncAt, upsertQuotes, type RemoteQuote } from '@/db/quotesCache';

const PAGE_SIZE = 500;

type QuoteRow = {
  id: number;
  text: string;
  text_tr: string;
  author: string;
  origin: string;
  origin_emoji: string;
  category: string;
  era: string;
  tags: string[];
  is_premium: boolean;
  pack_id: string | null;
  updated_at: string;
};

function toRemoteQuote(row: QuoteRow): RemoteQuote {
  return {
    id: row.id,
    text: row.text,
    textTr: row.text_tr,
    author: row.author,
    origin: row.origin,
    originEmoji: row.origin_emoji,
    category: row.category,
    era: row.era,
    tags: row.tags,
    isPremium: row.is_premium,
    packId: row.pack_id,
    updatedAt: row.updated_at,
  };
}

async function fetchUpdatedSince(sinceIso: string): Promise<QuoteRow[]> {
  if (!supabase) return [];
  const all: QuoteRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('quotes')
      .select('id, text, text_tr, author, origin, origin_emoji, category, era, tags, is_premium, pack_id, updated_at')
      .gt('updated_at', sinceIso)
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as QuoteRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

/** Tüm premium satırları çeker — `updated_at` imleci KULLANILMAZ (bkz. syncPremiumQuotes). */
async function fetchAllPremium(): Promise<QuoteRow[]> {
  if (!supabase) return [];
  const all: QuoteRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('quotes')
      .select('id, text, text_tr, author, origin, origin_emoji, category, era, tags, is_premium, pack_id, updated_at')
      .eq('is_premium', true)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as QuoteRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

/**
 * Premium sözleri yeniden indirir (entitlement geri geldiğinde geri yükleme).
 *
 * NEDEN AYRI BİR FONKSİYON: `syncQuotes` delta çalışır (`updated_at > imleç`).
 * Abonelik bittiğinde premium satırlar yerel olarak silinir ama sunucudaki
 * `updated_at` değerleri değişmez — imleç zaten onların ötesinde olduğu için
 * normal delta senkronu o satırları BİR DAHA ASLA getirmez ve kullanıcı tekrar
 * abone olsa bile içerik geri gelmez. Bu yüzden burada imleç filtresi yok:
 * koşul sadece `is_premium = true`.
 *
 * `meta.last_sync_at` imlecine bilinçli olarak DOKUNMAZ: bu bir geri-doldurma,
 * delta akışının bir adımı değil — imleci ilerletmek, arada güncellenmiş
 * ücretsiz satırların atlanmasına yol açardı.
 *
 * RLS gereği premium satırlar yalnızca `profiles.is_premium = true` olan oturum
 * açmış kullanıcıya döner; hak yoksa sunucu boş liste verir (sessizce 0 döner).
 *
 * `isCancelled`: indirme 2-5 sn sürüyor; bu sırada kullanıcı çıkış yaparsa
 * (`signOut` → cache temizlenir) uçuşta olan bu çekimin satırları temizliğin
 * ÜSTÜNE yazılmamalı. Kontrol noktası bilinçli olarak çekim ile yazma ARASINDA:
 * `fetchAllPremium` tüm sayfaları önce toplayıp tek seferde yazdığı için,
 * burada vazgeçmek hiçbir satır yazılmadığı anlamına gelir (yarım cache oluşmaz).
 */
export async function syncPremiumQuotes(options?: {
  isCancelled?: () => boolean;
}): Promise<{ synced: number; cancelled: boolean }> {
  if (!supabase) return { synced: 0, cancelled: false };
  try {
    const rows = await fetchAllPremium();
    if (options?.isCancelled?.()) return { synced: 0, cancelled: true };
    if (rows.length === 0) return { synced: 0, cancelled: false };
    upsertQuotes(rows.map(toRemoteQuote));
    return { synced: rows.length, cancelled: false };
  } catch {
    // Ağ/RLS hatası — sessizce vazgeç; çağıran taraf (premiumCacheGuard) yeniden dener.
    return { synced: 0, cancelled: false };
  }
}

/**
 * Yerel SQLite cache'i Supabase `quotes` tablosuyla senkronize eder.
 * Ağ yoksa / Supabase yapılandırılmamışsa (bkz. src/lib/supabase.ts) sessizce
 * hiçbir şey yapmaz — free/offline deneyim buna bağımlı değildir.
 */
export async function syncQuotes(): Promise<{ synced: number }> {
  if (!supabase) return { synced: 0 };

  try {
    const since = getLastSyncAt() ?? new Date(0).toISOString();
    const rows = await fetchUpdatedSince(since);
    if (rows.length === 0) return { synced: 0 };

    upsertQuotes(rows.map(toRemoteQuote));
    const newest = rows.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), since);
    setLastSyncAt(newest);
    return { synced: rows.length };
  } catch {
    // Ağ hatası / geçici Supabase kesintisi — sessizce vazgeç, bir sonraki
    // açılışta tekrar denenir. Kullanıcı hiçbir zaman bunu görmemeli.
    return { synced: 0 };
  }
}
