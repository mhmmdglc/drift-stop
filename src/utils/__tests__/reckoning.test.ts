/// <reference types="jest" />
import { computeStreak, pruneLog, weekSummary, type ReckoningLog } from '../reckoning';
import { dateKey } from '@/utils/timeUtils';

// Sabit çapa: 2026-08-19 bir ÇARŞAMBA (hafta sonu değil) — hafta sonu testleri
// için ayrıca 2026-08-15/16 (Cts/Paz) kullanılıyor.
const TODAY = '2026-08-19';

/** `base`den `deltaDays` gün önce/sonrasının `dateKey`'i (yerel bileşenlerden). */
function keyOffset(base: string, deltaDays: number): string {
  const [y, m, d] = base.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return dateKey(dt);
}

describe('computeStreak', () => {
  it('kesintisiz resisted serisini sayar (bugün dahil)', () => {
    const log: ReckoningLog = {
      [TODAY]: 'resisted',
      [keyOffset(TODAY, -1)]: 'resisted',
      [keyOffset(TODAY, -2)]: 'resisted',
      [keyOffset(TODAY, -3)]: 'resisted',
    };
    expect(computeStreak(log, TODAY)).toBe(4);
  });

  it('bugün drifted ise streak sıfır — geçmiş ne olursa olsun', () => {
    const log: ReckoningLog = {
      [TODAY]: 'drifted',
      [keyOffset(TODAY, -1)]: 'resisted',
      [keyOffset(TODAY, -2)]: 'resisted',
    };
    expect(computeStreak(log, TODAY)).toBe(0);
  });

  it('bugün cevapsızsa gün henüz bitmedi sayılır — dünden geriye bakar, sıfırlamaz', () => {
    const log: ReckoningLog = {
      [keyOffset(TODAY, -1)]: 'resisted',
      [keyOffset(TODAY, -2)]: 'resisted',
      [keyOffset(TODAY, -3)]: 'resisted',
    };
    expect(computeStreak(log, TODAY)).toBe(3);
  });

  it('cevapsız bir gün zinciri kırar — kaçmakla aynı muamele', () => {
    const log: ReckoningLog = {
      [TODAY]: 'resisted',
      [keyOffset(TODAY, -1)]: 'resisted',
      // keyOffset(TODAY, -2) cevapsız → zincir burada kırılır
      [keyOffset(TODAY, -3)]: 'resisted',
    };
    expect(computeStreak(log, TODAY)).toBe(2);
  });

  it('drifted bir gün zinciri kırar', () => {
    const log: ReckoningLog = {
      [TODAY]: 'resisted',
      [keyOffset(TODAY, -1)]: 'drifted',
      [keyOffset(TODAY, -2)]: 'resisted',
    };
    expect(computeStreak(log, TODAY)).toBe(1);
  });

  it('boş log → streak 0', () => {
    expect(computeStreak({}, TODAY)).toBe(0);
  });

  it('disableWeekends kapalıyken hafta sonu cevapsızlığı zinciri kırar', () => {
    // 2026-08-17 Pzt, 08-15/16 Cts/Paz cevapsız, 08-14 Cum resisted.
    const log: ReckoningLog = {
      '2026-08-17': 'resisted',
      '2026-08-14': 'resisted',
    };
    expect(computeStreak(log, '2026-08-17', false)).toBe(1);
  });

  it('disableWeekends açıkken hafta sonu günleri yok sayılır, zincir kırılmaz', () => {
    // 2026-08-17 Pzt (resisted), 08-15/16 Cts/Paz muaf (cevapsız ama sayılmaz),
    // 08-14 Cum (resisted) → zincir Pzt→Cum kesintisiz sayılmalı.
    const log: ReckoningLog = {
      '2026-08-17': 'resisted',
      '2026-08-14': 'resisted',
    };
    expect(computeStreak(log, '2026-08-17', true)).toBe(2);
  });

  it('disableWeekends açıkken hafta sonu drifted olsa bile yok sayılır', () => {
    const log: ReckoningLog = {
      '2026-08-17': 'resisted',
      '2026-08-15': 'drifted', // Cumartesi — muaf, dikkate alınmamalı
      '2026-08-14': 'resisted',
    };
    expect(computeStreak(log, '2026-08-17', true)).toBe(2);
  });
});

describe('weekSummary', () => {
  it('bugün dahil son 7 günü sayar (payda 7, hafta sonu kapalı)', () => {
    const log: ReckoningLog = {
      [TODAY]: 'resisted',
      [keyOffset(TODAY, -1)]: 'resisted',
      [keyOffset(TODAY, -2)]: 'drifted',
      // -3, -4, -5, -6 cevapsız
    };
    const s = weekSummary(log, TODAY);
    expect(s).toEqual({ resisted: 2, drifted: 1, unanswered: 4, total: 7 });
  });

  it('8 gün önceki kayıt pencereye girmez', () => {
    const log: ReckoningLog = { [keyOffset(TODAY, -7)]: 'resisted' };
    const s = weekSummary(log, TODAY);
    expect(s.resisted).toBe(0);
    expect(s.unanswered).toBe(7);
  });

  it('disableWeekends açıkken payda 7 değil, aktif gün sayısıdır', () => {
    // 2026-08-17 Pzt çapası: son 7 gün 08-11..08-17 → içinde 08-15(Cts)/08-16(Paz) muaf.
    const s = weekSummary({}, '2026-08-17', true);
    expect(s.total).toBe(5);
  });
});

describe('pruneLog', () => {
  const now = new Date(2026, 7, 19); // 2026-08-19

  it('90 günden eskiyi siler, yeniyi korur', () => {
    const old = keyOffset('2026-08-19', -91);
    const recent = keyOffset('2026-08-19', -10);
    const log: ReckoningLog = { [old]: 'resisted', [recent]: 'drifted' };

    const pruned = pruneLog(log, now);

    expect(pruned).toEqual({ [recent]: 'drifted' });
  });

  it('tam 90 gün sınırındaki kayıt korunur (cutoff dahil)', () => {
    const boundary = keyOffset('2026-08-19', -90);
    const log: ReckoningLog = { [boundary]: 'resisted' };

    expect(pruneLog(log, now)).toEqual({ [boundary]: 'resisted' });
  });

  it('boş log değişmeden kalır', () => {
    expect(pruneLog({}, now)).toEqual({});
  });
});
