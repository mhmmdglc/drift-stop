import type { Quote, QuoteTag } from '@/types/quote';

import raw from './quotes.json';

export const QUOTES: Quote[] = raw as Quote[];

export const QUOTE_COUNT = QUOTES.length;

const byId = new Map<number, Quote>(QUOTES.map((q) => [q.id, q]));

export function getQuoteById(id: number): Quote | undefined {
  return byId.get(id);
}

/**
 * Seçili temalara (tag) göre sözleri filtreler.
 * themes boşsa veya eşleşme yoksa TÜM sözler döner (boş ekran olmasın).
 */
export function getQuotesByThemes(themes: QuoteTag[]): Quote[] {
  if (!themes || themes.length === 0) return QUOTES;
  const set = new Set(themes);
  const filtered = QUOTES.filter((q) => q.tags.some((t) => set.has(t)));
  return filtered.length > 0 ? filtered : QUOTES;
}
