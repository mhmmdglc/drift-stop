/// <reference types="jest" />
import { pickUnseenQuoteId, randomIndex, type Rng } from '@/utils/quoteSelector';
import type { Quote } from '@/types/quote';

function seqRng(values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length];
}

const mkQuotes = (n: number): Quote[] =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    text: `t${i + 1}`,
    textTr: `m${i + 1}`,
    author: 'a',
    origin: 'o',
    originEmoji: '🔥',
    category: 'fire',
    era: 'modern',
    tags: ['motivation'],
  }));

describe('randomIndex', () => {
  it('returns 0 for single item', () => {
    expect(randomIndex(1)).toBe(0);
  });
  it('returns -1 for empty', () => {
    expect(randomIndex(0)).toBe(-1);
  });
  it('stays within range', () => {
    const rng = seqRng([0, 0.25, 0.5, 0.75, 0.99]);
    for (let k = 0; k < 5; k++) {
      const i = randomIndex(10, undefined, rng);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(10);
    }
  });
  it('never returns the excluded index', () => {
    for (let r = 0; r < 20; r++) {
      const rng = seqRng([r / 20]);
      const i = randomIndex(8, 3, rng);
      expect(i).not.toBe(3);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(8);
    }
  });
});

describe('pickUnseenQuoteId', () => {
  it('returns an id not in the seen list', () => {
    const quotes = mkQuotes(5);
    const seen = [1, 2, 3];
    const rng = seqRng([0, 0.5, 0.99]);
    const id = pickUnseenQuoteId(quotes, seen, rng);
    expect([4, 5]).toContain(id);
  });
  it('falls back to full pool when all seen', () => {
    const quotes = mkQuotes(3);
    const id = pickUnseenQuoteId(quotes, [1, 2, 3], seqRng([0.5]));
    expect([1, 2, 3]).toContain(id);
  });
  it('returns -1 for empty quotes', () => {
    expect(pickUnseenQuoteId([], [], seqRng([0]))).toBe(-1);
  });
});
