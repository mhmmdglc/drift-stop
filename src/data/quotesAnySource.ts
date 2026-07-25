import { getQuoteById } from '@/data/quotes';
import {
  getCachedQuoteById,
  getCachedQuotesByAuthor,
  getCachedQuotesByPackId,
  isPurgedPremiumQuoteId,
} from '@/db/quotesCache';
import type { Quote } from '@/types/quote';

/**
 * Faz 4 — gömülü 1000 sözün YANI SIRA premium paket sözlerini de bulur.
 * Önce statik diziye bakar (yaygın durum, O(1), senkron/hızlı), sonra yerel
 * SQLite cache'e düşer (premium paket sözleri sadece orada var — bkz.
 * `src/services/quotesSync.ts`). Ana akışlar (Home/widget/bildirim) bilinçli
 * olarak bu modülü KULLANMIYOR — sadece favoriler ve söz detayı gibi, pakete
 * özel sözlere de erişebilmesi gereken ekranlar kullanır.
 *
 * ENTITLEMENT: her okuma `entitled` bilgisini ZORUNLU olarak almak durumunda.
 * Asıl kapı SUNUCUDA: `quotes_premium_read_entitled` politikası premium satırların
 * İNDİRİLMESİNİ `profiles.is_premium`'a bağlıyor ve migration 0004'ten beri istemci
 * rolleri o kolonu yazamıyor (yalnızca `revenuecat-webhook`, service_role ile) —
 * yani hak sunucuda karara bağlanıyor, istemcide değil. Buradaki kontrol İKİNCİ
 * savunma hattı: daha önce indirilmiş bir kopya cihazda kaldıysa (temizlik
 * başarısız olduysa ya da bir yarışa girdiyse) hakkı olmayan kullanıcıya premium
 * metin yine de verilmez. `entitled` her zaman `usePurchases().isPro`'dan gelir;
 * UI kilitleriyle aynı kaynak — ve bu değer sunucuya karşı ASLA kanıt olarak
 * kullanılmaz, sadece yerel gösterimi kısıtlar.
 */

export type QuoteLookup =
  /** Söz bulundu ve kullanıcı görebilir. */
  | { status: 'found'; quote: Quote }
  /** Söz premium: ya cache'te duruyor ama hak yok, ya da hak bitince silinmiş. */
  | { status: 'locked' }
  /** Hiçbir kaynakta yok (silinmiş/geçersiz id). */
  | { status: 'missing' };

export function lookupQuoteAnySource(id: number, { entitled }: { entitled: boolean }): QuoteLookup {
  const staticQuote = getQuoteById(id);
  if (staticQuote) return { status: 'found', quote: staticQuote };

  const cached = getCachedQuoteById(id);
  if (cached) {
    if (cached.isPremium && !entitled) return { status: 'locked' };
    return { status: 'found', quote: cached };
  }

  // Satır yok ama daha önce premium olarak silinmiş → kullanıcıya boş/kayıp değil
  // "kilitli" durumu göstermek için bunu bilmemiz gerekiyor (bkz. purgePremiumQuotes).
  if (isPurgedPremiumQuoteId(id)) return { status: 'locked' };

  return { status: 'missing' };
}

/**
 * Bir pakete ait sözleri döner (sadece cache'ten — premium olanlar hiç statik
 * dizide olmaz). Hak yoksa paketin premium satırları düşülür; aynı pakette
 * ücretsiz satır varsa o görünmeye devam eder.
 */
export function getPackQuotes(packId: string, { entitled }: { entitled: boolean }): Quote[] {
  const rows = getCachedQuotesByPackId(packId);
  return entitled ? rows : rows.filter((q) => !q.isPremium);
}

/** Belirli bir yazarın tüm premium sözleri. Yazar listeleri tanım gereği premium. */
export function getAuthorQuotes(author: string, { entitled }: { entitled: boolean }): Quote[] {
  if (!entitled) return [];
  return getCachedQuotesByAuthor(author);
}
