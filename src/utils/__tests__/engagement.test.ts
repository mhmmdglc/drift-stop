/// <reference types="jest" />
import {
  ENGAGEMENT_LOG_MAX_AGE_DAYS,
  MIN_ENGAGEMENT_LOG_FOR_WEIGHTS,
  hourWeights,
  pruneEngagementLog,
} from '@/utils/engagement';
import type { EngagementEntry } from '@/utils/quoteAction';

/** 20 kayıtlık asgari eşiği geçen bir log üretir; her kayıt `at` alanı için ayrı ms verilebilir. */
function makeLog(hours: number[], baseAt = 1_000_000): EngagementEntry[] {
  return hours.map((hour, i) => ({ hour, at: baseAt + i }));
}

describe('hourWeights', () => {
  it('returns null when log has fewer than MIN_ENGAGEMENT_LOG_FOR_WEIGHTS entries', () => {
    expect(MIN_ENGAGEMENT_LOG_FOR_WEIGHTS).toBe(20);
    const shortLog = makeLog(new Array(19).fill(20));
    expect(hourWeights(shortLog)).toBeNull();
  });

  it('accepts exactly the threshold', () => {
    const log = makeLog(new Array(20).fill(20));
    expect(hourWeights(log)).not.toBeNull();
  });

  it('builds a known histogram with ±1 hour smoothing', () => {
    // 20 kayıt: 15 tanesi saat 20'de, 5 tanesi saat 8'de — elle hesaplanmış beklenti.
    const hours = [...new Array(15).fill(20), ...new Array(5).fill(8)];
    const log = makeLog(hours);
    const weights = hourWeights(log);
    expect(weights).not.toBeNull();
    if (!weights) return;

    // saat 20: kendi kaydı (15 * 1) + komşu saat 19 ve 21'den katkı yok (kendileri hiç kayıt değil)
    expect(weights[20]).toBe(15);
    // komşu saatler: 19 ve 21, her biri 15 * 0.5 = 7.5 alır
    expect(weights[19]).toBe(7.5);
    expect(weights[21]).toBe(7.5);
    // saat 8: 5 kayıt
    expect(weights[8]).toBe(5);
    expect(weights[7]).toBe(2.5);
    expect(weights[9]).toBe(2.5);
    // dokunulmayan saatler 0 kalır
    expect(weights[0]).toBe(0);
    expect(weights[12]).toBe(0);
    // 24 saatin hepsi anahtar olarak mevcut
    expect(Object.keys(weights)).toHaveLength(24);
  });

  it('wraps around midnight for smoothing (hour 0 and hour 23 are neighbours)', () => {
    const hours = new Array(20).fill(0); // gece yarısı
    const log = makeLog(hours);
    const weights = hourWeights(log);
    expect(weights).not.toBeNull();
    if (!weights) return;
    expect(weights[0]).toBe(20);
    expect(weights[23]).toBe(10); // (0 - 1) mod 24 = 23
    expect(weights[1]).toBe(10);
  });

  it('sums overlapping smoothing contributions from adjacent hours', () => {
    // saat 10 ve 11'e 10'ar kayıt: 11'in kendi katkısı (10) + 10'un komşu katkısı (5) = 15
    const hours = [...new Array(10).fill(10), ...new Array(10).fill(11)];
    const log = makeLog(hours);
    const weights = hourWeights(log);
    expect(weights).not.toBeNull();
    if (!weights) return;
    expect(weights[10]).toBe(10 + 5); // kendi + 11'den komşu katkı
    expect(weights[11]).toBe(10 + 5); // kendi + 10'dan komşu katkı
    expect(weights[9]).toBe(5); // yalnızca 10'un komşu katkısı
    expect(weights[12]).toBe(5); // yalnızca 11'in komşu katkısı
  });
});

describe('pruneEngagementLog', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const now = 100 * DAY_MS; // sabit referans an

  it('keeps entries within the max age', () => {
    const log: EngagementEntry[] = [{ hour: 10, at: now - 1 * DAY_MS }];
    expect(pruneEngagementLog(log, now)).toEqual(log);
  });

  it('keeps an entry exactly at the boundary (90 days old)', () => {
    const boundaryEntry: EngagementEntry = { hour: 10, at: now - ENGAGEMENT_LOG_MAX_AGE_DAYS * DAY_MS };
    const log = [boundaryEntry];
    expect(pruneEngagementLog(log, now)).toEqual([boundaryEntry]);
  });

  it('drops an entry that is 91 days old', () => {
    const staleEntry: EngagementEntry = { hour: 10, at: now - 91 * DAY_MS };
    const log = [staleEntry];
    expect(pruneEngagementLog(log, now)).toEqual([]);
  });

  it('respects a custom maxAgeDays', () => {
    const log: EngagementEntry[] = [{ hour: 10, at: now - 5 * DAY_MS }];
    expect(pruneEngagementLog(log, now, 3)).toEqual([]);
    expect(pruneEngagementLog(log, now, 10)).toEqual(log);
  });

  it('filters a mixed log, keeping only fresh entries', () => {
    const fresh: EngagementEntry = { hour: 9, at: now - 1 * DAY_MS };
    const stale: EngagementEntry = { hour: 9, at: now - 200 * DAY_MS };
    expect(pruneEngagementLog([fresh, stale], now)).toEqual([fresh]);
  });
});
