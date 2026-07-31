/// <reference types="jest" />
import { computeTrialState, TRIAL_DAYS } from '../trial';

/** Yerel gün başlangıcı — testler duvar saatiyle düşünsün diye. */
function localNoon(y: number, m: number, d: number, hour = 12): number {
  return new Date(y, m - 1, d, hour, 0, 0, 0).getTime();
}

describe('computeTrialState', () => {
  it('deneme başlamadıysa hak vermez', () => {
    const s = computeTrialState(null, localNoon(2026, 8, 1));
    expect(s).toEqual({ startedAt: null, dayIndex: -1, active: false, daysLeft: 0 });
  });

  it('kurulum günü 0. gündür ve 7 gün kalmıştır', () => {
    const start = localNoon(2026, 8, 1, 9);
    const s = computeTrialState(start, localNoon(2026, 8, 1, 23));
    expect(s.dayIndex).toBe(0);
    expect(s.active).toBe(true);
    expect(s.daysLeft).toBe(TRIAL_DAYS);
  });

  it('gün sınırı SAAT değil TAKVİM günüdür — 23:59da kurup 00:01de açmak 1. gündür', () => {
    // 24 saat geçmedi ama takvim günü değişti. Kullanıcının gördüğü şey takvim.
    const start = new Date(2026, 7, 1, 23, 59, 0, 0).getTime();
    const s = computeTrialState(start, new Date(2026, 7, 2, 0, 1, 0, 0).getTime());
    expect(s.dayIndex).toBe(1);
    expect(s.daysLeft).toBe(TRIAL_DAYS - 1);
    expect(s.active).toBe(true);
  });

  it('6. günde bir gün kalmıştır (ön bilgilendirme bildirimi bu güne kurulacak)', () => {
    const start = localNoon(2026, 8, 1);
    const s = computeTrialState(start, localNoon(2026, 8, 7));
    expect(s.dayIndex).toBe(6);
    expect(s.daysLeft).toBe(1);
    expect(s.active).toBe(true);
  });

  it('8. takvim gününde deneme BİTER', () => {
    const start = localNoon(2026, 8, 1);
    const s = computeTrialState(start, localNoon(2026, 8, 8));
    expect(s.dayIndex).toBe(TRIAL_DAYS);
    expect(s.active).toBe(false);
    expect(s.daysLeft).toBe(0);
  });

  it('çok sonra açılsa da bitmiş kalır', () => {
    const start = localNoon(2026, 8, 1);
    const s = computeTrialState(start, localNoon(2027, 3, 1));
    expect(s.active).toBe(false);
    expect(s.daysLeft).toBe(0);
  });

  it('cihaz saati geriye alınırsa denemeyi BİTMİŞ saymaz ama uzatmaz da', () => {
    // Negatif fark: kullanıcı saati kurulumdan öncesine almış. 0. gün gibi davranır;
    // istismar koruması yazılmayacağı kararı gereği (spec §5.2) sadece çökmemesi yeterli.
    const start = localNoon(2026, 8, 10);
    const s = computeTrialState(start, localNoon(2026, 8, 1));
    expect(s.dayIndex).toBe(0);
    expect(s.active).toBe(true);
    expect(s.daysLeft).toBe(TRIAL_DAYS);
  });
});
