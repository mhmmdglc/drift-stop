import { getQuoteById } from '@/data/quotes';
import { getCachedQuoteById, getCachedQuotesByAuthor, getCachedQuotesByPackId } from '@/db/quotesCache';
import type { Quote } from '@/types/quote';

/**
 * Faz 4 — gömülü 1000 sözün YANI SIRA premium paket sözlerini de bulur.
 * Önce statik diziye bakar (yaygın durum, O(1), senkron/hızlı), sonra yerel
 * SQLite cache'e düşer (premium paket sözleri sadece orada var — bkz.
 * `src/services/quotesSync.ts`). Ana akışlar (Home/widget/bildirim) bilinçli
 * olarak bu fonksiyonu KULLANMIYOR — sadece favoriler ve söz detayı gibi,
 * pakete özel sözlere de erişebilmesi gereken ekranlar kullanır.
 */
export function getQuoteByIdAnySource(id: number): Quote | undefined {
  const staticQuote = getQuoteById(id);
  if (staticQuote) return staticQuote;
  return getCachedQuoteById(id) ?? undefined;
}

/** Bir premium pakete ait sözleri döner (sadece cache'ten — bunlar hiç statik dizide olmaz). */
export function getPackQuotes(packId: string): Quote[] {
  return getCachedQuotesByPackId(packId);
}

/** Belirli bir yazarın tüm premium sözlerini döner (hangi pakete ait olduğundan bağımsız). */
export function getAuthorQuotes(author: string): Quote[] {
  return getCachedQuotesByAuthor(author);
}
