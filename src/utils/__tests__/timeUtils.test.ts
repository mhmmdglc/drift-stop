/// <reference types="jest" />
import type { Rng } from '@/utils/quoteSelector';
import {
  dateKey,
  formatHM,
  generateRandomTimes,
  isValidWindow,
  isWeekend,
  toMinutes,
  windowOf,
} from '@/utils/timeUtils';
import { DEFAULT_SETTINGS } from '@/types/settings';

/** Deterministik rng: verilen değer dizisini döngüsel olarak döndürür. */
function seqRng(values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('formatHM', () => {
  it('pads hours and minutes', () => {
    expect(formatHM(9, 0)).toBe('09:00');
    expect(formatHM(21, 5)).toBe('21:05');
    expect(formatHM(0, 0)).toBe('00:00');
  });
});

describe('toMinutes / windowOf', () => {
  it('converts hours+minutes to minutes of day', () => {
    expect(toMinutes(9, 0)).toBe(540);
    expect(toMinutes(21, 0)).toBe(1260);
  });
  it('reads window from settings', () => {
    expect(windowOf(DEFAULT_SETTINGS)).toEqual({ startMin: 540, endMin: 1260 });
  });
});

describe('isValidWindow', () => {
  it('requires at least 2 hours', () => {
    expect(isValidWindow(540, 1260)).toBe(true);
    expect(isValidWindow(540, 660)).toBe(true); // tam 120 dk
    expect(isValidWindow(540, 600)).toBe(false); // 60 dk
    expect(isValidWindow(600, 540)).toBe(false); // ters
  });
});

describe('isWeekend', () => {
  it('detects saturday and sunday', () => {
    expect(isWeekend(new Date(2024, 0, 6))).toBe(true); // Cumartesi
    expect(isWeekend(new Date(2024, 0, 7))).toBe(true); // Pazar
    expect(isWeekend(new Date(2024, 0, 8))).toBe(false); // Pazartesi
  });
});

describe('dateKey', () => {
  it('formats YYYY-MM-DD', () => {
    expect(dateKey(new Date(2026, 5, 21))).toBe('2026-06-21');
    expect(dateKey(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
});

describe('generateRandomTimes', () => {
  it('returns requested count within window, sorted', () => {
    const rng = seqRng([0.05, 0.4, 0.7, 0.2, 0.9, 0.55, 0.33, 0.66, 0.11, 0.88]);
    const times = generateRandomTimes(540, 1260, 5, 90, rng);
    expect(times).toHaveLength(5);
    for (const t of times) {
      expect(t).toBeGreaterThanOrEqual(540);
      expect(t).toBeLessThanOrEqual(1260);
    }
    const sorted = [...times].sort((a, b) => a - b);
    expect(times).toEqual(sorted);
  });

  it('produces unique times', () => {
    const rng = seqRng([0.1, 0.3, 0.5, 0.7, 0.9, 0.2, 0.4, 0.6, 0.8, 0.05]);
    const times = generateRandomTimes(540, 1260, 7, 90, rng);
    expect(new Set(times).size).toBe(times.length);
  });

  it('handles edge cases', () => {
    expect(generateRandomTimes(540, 540, 5)).toEqual([]);
    expect(generateRandomTimes(540, 1260, 0)).toEqual([]);
  });

  it('still fills count even when window is tight for the gap', () => {
    const times = generateRandomTimes(540, 660, 10, 90); // 120 dk pencere, 10 bildirim
    expect(times).toHaveLength(10);
  });
});
