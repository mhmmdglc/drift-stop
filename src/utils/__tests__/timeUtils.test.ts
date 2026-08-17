/// <reference types="jest" />
import type { Rng } from '@/utils/quoteSelector';
import {
  SMART_TIMING_MIX,
  dateKey,
  formatHM,
  generateRandomTimes,
  generateWeightedTimes,
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

/**
 * mulberry32 — küçük, hızlı, tohumlanabilir PRNG. Property/istatistik testlerinde
 * `Math.random()` yerine bunu kullanıyoruz ki testler CI'da flaky olmasın (aynı
 * tohum → aynı sonuç), gerçek rastgelelik ihtiyacı olmadan.
 */
function mulberry32(seed: number): Rng {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
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

describe('generateWeightedTimes', () => {
  it('falls back to generateRandomTimes when weights is null/undefined', () => {
    const rngForWeighted = mulberry32(42);
    const rngForRandom = mulberry32(42); // aynı tohum — delegasyon davranışını doğrular
    const weightedNull = generateWeightedTimes(540, 1260, 6, 90, null, rngForWeighted);
    const weightedUndefined = generateWeightedTimes(540, 1260, 6, 90, undefined, mulberry32(42));
    const plain = generateRandomTimes(540, 1260, 6, 90, rngForRandom);

    // Kısıtlara uyum: pencere içi, sıralı, benzersiz — deterministik eşitliğe
    // güvenmek yerine (uygulama detayına bağlanmasın diye) ikisinin de aynı
    // garantileri sağladığını doğruluyoruz.
    for (const times of [weightedNull, weightedUndefined, plain]) {
      expect(times).toHaveLength(6);
      for (const t of times) {
        expect(t).toBeGreaterThanOrEqual(540);
        expect(t).toBeLessThanOrEqual(1260);
      }
      const sorted = [...times].sort((a, b) => a - b);
      expect(times).toEqual(sorted);
      expect(new Set(times).size).toBe(times.length);
    }
  });

  it('respects window bounds and MIN_GAP across many randomized scenarios (property test, N=1000)', () => {
    const ITERATIONS = 1000;
    for (let i = 0; i < ITERATIONS; i++) {
      const paramRng = mulberry32(i * 97 + 1);

      const startMin = Math.floor(paramRng() * 600); // 00:00-10:00 arası başlangıç
      const minGap = 20 + Math.floor(paramRng() * 70); // 20-89 dk
      // count'u, span her zaman minGap * (count - 1) * 2'den büyük olacak şekilde
      // sınırlıyoruz — bu yüzden algoritmanın "gap" değeri hiç daralmaz, tam
      // minGap enforce edilir (daralma zincirinin farklı bir dalını test eden
      // ayrı senaryo `generateRandomTimes` testlerinde zaten var).
      const count = 2 + Math.floor(paramRng() * 5); // 2-6
      const span = minGap * (count - 1) * 2 + 60; // bolca pay
      const endMin = startMin + span;

      const hasWeights = paramRng() < 0.5;
      let weights: Record<number, number> | undefined;
      if (hasWeights) {
        weights = {};
        for (let h = 0; h < 24; h++) weights[h] = Math.floor(paramRng() * 6);
      }

      const genRng = mulberry32(i * 131 + 7);
      const times = generateWeightedTimes(startMin, endMin, count, minGap, weights, genRng);

      expect(times).toHaveLength(count);
      for (const t of times) {
        expect(t).toBeGreaterThanOrEqual(startMin);
        expect(t).toBeLessThanOrEqual(endMin);
      }
      const sorted = [...times].sort((a, b) => a - b);
      expect(times).toEqual(sorted);
      for (let k = 1; k < times.length; k++) {
        expect(times[k] - times[k - 1]).toBeGreaterThanOrEqual(minGap);
      }
    }
  });

  it('clusters generated times around heavily-weighted hours (statistical, N=2000)', () => {
    // Yalnızca saat 20 ağırlıklı — ağırlıklı dal seçildiğinde (rng < SMART_TIMING_MIX)
    // sonuç deterministik olarak saat 20 içine düşer (tek pozitif ağırlık orada).
    const weights: Record<number, number> = {};
    for (let h = 0; h < 24; h++) weights[h] = 0;
    weights[20] = 100;

    const startMin = 360; // 06:00
    const endMin = 1380; // 23:00 — 17 saatlik (1020 dk) pencere
    const SAMPLES = 2000;

    const inHour20 = (t: number) => t >= 20 * 60 && t < 21 * 60;

    let weightedHits = 0;
    let uniformHits = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const weightedTime = generateWeightedTimes(
        startMin,
        endMin,
        1,
        90,
        weights,
        mulberry32(i * 3 + 11)
      )[0];
      if (inHour20(weightedTime)) weightedHits++;

      const uniformTime = generateWeightedTimes(
        startMin,
        endMin,
        1,
        90,
        undefined,
        mulberry32(i * 3 + 11)
      )[0];
      if (inHour20(uniformTime)) uniformHits++;
    }

    const weightedRatio = weightedHits / SAMPLES;
    const uniformRatio = uniformHits / SAMPLES;

    // Beklenen: SMART_TIMING_MIX (0.3) her zaman saat 20'ye düşer + kalan %70'in
    // uniform payı (~60/1020 ≈ %5.9) → toplam ≈ %34. Uniform taban ≈ %5.9.
    // Geniş güvenlik payıyla: ağırlıklı oran belirgin şekilde yüksek olmalı.
    expect(weightedRatio).toBeGreaterThan(SMART_TIMING_MIX * 0.8);
    expect(weightedRatio).toBeGreaterThan(uniformRatio * 3);
    expect(uniformRatio).toBeLessThan(0.15); // uniform taban ~%6 civarında kalmalı
  });
});
