/// <reference types="jest" />
import { randomIndex, type Rng } from '@/utils/quoteSelector';

function seqRng(values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length];
}

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
