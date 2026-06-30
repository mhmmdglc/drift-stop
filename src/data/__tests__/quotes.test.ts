/// <reference types="jest" />
import { getQuotesByThemes, QUOTES, QUOTE_COUNT, getQuoteById } from '@/data/quotes';
import { QUOTE_CATEGORIES, QUOTE_ERAS, QUOTE_TAGS } from '@/types/quote';

const categories = new Set<string>(QUOTE_CATEGORIES);
const eras = new Set<string>(QUOTE_ERAS);
const tags = new Set<string>(QUOTE_TAGS);

describe('quotes dataset', () => {
  it('has 1000 quotes', () => {
    expect(QUOTE_COUNT).toBe(1000);
  });

  it('has sequential unique ids 1..1000', () => {
    const ids = QUOTES.map((q) => q.id);
    expect(new Set(ids).size).toBe(1000);
    expect(Math.min(...ids)).toBe(1);
    expect(Math.max(...ids)).toBe(1000);
  });

  it('every quote has valid, non-empty fields', () => {
    for (const q of QUOTES) {
      expect(q.text.trim().length).toBeGreaterThan(0);
      expect(q.textTr.trim().length).toBeGreaterThan(0);
      expect(q.author.trim().length).toBeGreaterThan(0);
      expect(q.origin.trim().length).toBeGreaterThan(0);
      expect(q.originEmoji.trim().length).toBeGreaterThan(0);
      expect(categories.has(q.category)).toBe(true);
      expect(eras.has(q.era)).toBe(true);
    }
  });

  it('has no Unknown/Belirsiz attributions', () => {
    const bad = QUOTES.filter(
      (q) => /unknown|belirsiz|anonim|anonymous/i.test(q.author) || /belirsiz/i.test(q.origin)
    );
    expect(bad).toHaveLength(0);
  });

  it('has unique Turkish texts', () => {
    const set = new Set(QUOTES.map((q) => q.textTr.toLowerCase().trim()));
    expect(set.size).toBe(1000);
  });

  it('getQuoteById works', () => {
    expect(getQuoteById(1)?.id).toBe(1);
    expect(getQuoteById(1000)?.id).toBe(1000);
    expect(getQuoteById(99999)).toBeUndefined();
  });

  it('every quote has 1-4 valid theme tags', () => {
    for (const q of QUOTES) {
      expect(Array.isArray(q.tags)).toBe(true);
      expect(q.tags.length).toBeGreaterThanOrEqual(1);
      expect(q.tags.length).toBeLessThanOrEqual(4);
      for (const tg of q.tags) expect(tags.has(tg)).toBe(true);
      expect(new Set(q.tags).size).toBe(q.tags.length); // tekrar yok
    }
  });

  it('getQuotesByThemes filters by tag and falls back to all', () => {
    expect(getQuotesByThemes([]).length).toBe(1000);
    const peace = getQuotesByThemes(['peace']);
    expect(peace.length).toBeGreaterThan(0);
    expect(peace.length).toBeLessThan(1000);
    expect(peace.every((q) => q.tags.includes('peace'))).toBe(true);
  });
});
