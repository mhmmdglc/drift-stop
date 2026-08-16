import { getQuotesByThemes } from '@/data/quotes';
import type { Quote, QuoteTag } from '@/types/quote';

/** SOS bir açılış kaydı: ne zaman, hangi söz gösterildi. */
export type SosLogEntry = { at: number; quoteId: number };

/** `sosLog` bu kadarla kırpılır (favorites/history/reckoning ile aynı "cap" gerekçesi). */
export const SOS_LOG_CAP = 100;

/** Tekrar-önleme dışlama penceresi: son 20 SOS sözü. */
const SOS_EXCLUDE_WINDOW = 20;

/**
 * SOS havuzu: kullanıcının tema filtresinden BAĞIMSIZ, her zaman en sert iki tema
 * (`engagement-roadmap.md` W2.2 — "kriz anında 'seçtiğin temalar' değil 'en sert
 * olan' gelir"). SOS her zaman bu sabit listeyi kullanır.
 */
const SOS_TAGS: QuoteTag[] = ['reckoning', 'discipline'];

/**
 * Son 20 SOS sözünü dışlayarak havuzdan rastgele bir söz seçer. Dışlama havuzu
 * boşaltırsa (teorik olarak imkansız — havuz 492 söz — ama savunma her koşulda
 * doğru çalışsın) dışlama yok sayılır, tüm havuzdan seçilir.
 */
export function pickSosQuote(sosLog: SosLogEntry[]): Quote {
  const pool = getQuotesByThemes(SOS_TAGS);
  const exclude = new Set(sosLog.slice(0, SOS_EXCLUDE_WINDOW).map((e) => e.quoteId));
  const filtered = pool.filter((q) => !exclude.has(q.id));
  const from = filtered.length > 0 ? filtered : pool;
  return from[Math.floor(Math.random() * from.length)];
}

/**
 * SOS açılışını loglar. Söz SEÇİLDİĞİ anda (perde başlamadan önce) çağrılır —
 * kullanıcı perdeyi bitirmeden çıksa bile "SOS açıldı" beyanı kaydedilmiş olur
 * (`w2.2-ux.md` §3.6).
 */
export function logSosOpen(sosLog: SosLogEntry[], quoteId: number): SosLogEntry[] {
  return [{ at: Date.now(), quoteId }, ...sosLog].slice(0, SOS_LOG_CAP);
}
