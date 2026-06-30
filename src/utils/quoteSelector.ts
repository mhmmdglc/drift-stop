import type { Quote } from '@/types/quote';

/**
 * Saf seçim mantığı (test edilebilir, React'tan bağımsız).
 * `rng` enjekte edilebilir → testlerde deterministik.
 */
export type Rng = () => number;

const defaultRng: Rng = () => Math.random();

/** Listeden rastgele bir indeks seç; exclude verilirse onu atla (art arda tekrar yok). */
export function randomIndex(length: number, exclude?: number, rng: Rng = defaultRng): number {
  if (length <= 0) return -1;
  if (length === 1) return 0;
  let i = Math.floor(rng() * length);
  if (exclude !== undefined && i === exclude) {
    i = (i + 1 + Math.floor(rng() * (length - 1))) % length;
  }
  return i;
}

/**
 * Bildirimler için: "bugün görülenler" dışından rastgele bir söz id'si seç.
 * Hepsi görüldüyse listeyi sıfırla (seen boşmuş gibi davran).
 */
export function pickUnseenQuoteId(
  quotes: Quote[],
  seenIds: number[],
  rng: Rng = defaultRng
): number {
  if (quotes.length === 0) return -1;
  const seen = new Set(seenIds);
  const pool = quotes.filter((q) => !seen.has(q.id));
  const source = pool.length > 0 ? pool : quotes;
  const idx = Math.floor(rng() * source.length);
  return source[idx].id;
}
