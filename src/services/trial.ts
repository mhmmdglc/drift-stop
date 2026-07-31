import { getJSON, setJSON, StorageKeys } from '@/utils/storage';

/**
 * Kartsız 7 günlük deneme — durum hesabı ve kalıcılığı.
 *
 * Neden cihazda: kullanıcıların çoğu misafir olacak (giriş zorunlu değil), yani
 * denemenin başlangıcı sunucuda tutulamaz. Bu, yeniden kurulumla sıfırlanabilir
 * olması demek — **istismar koruması bilinçli olarak yazılmadı** (spec §0).
 * Aynı sebeple cihaz saati geriye alınırsa deneme uzar; kabul edilen risk.
 *
 * Bu modül SAF: `Date.now()`u kendisi okumaz, `now` parametre olarak gelir.
 * Sebep: gün sınırı mantığının testi ancak zaman enjekte edilebiliyorsa yazılabilir
 * ve bu mantık yanlış olursa kullanıcı ya bir gün fazla ya bir gün eksik Pro yaşar.
 */

export const TRIAL_DAYS = 7;

export type TrialState = {
  /** Deneme hiç başlamadıysa null. */
  startedAt: number | null;
  /**
   * Başlangıç gününden bu yana geçen YEREL takvim günü sayısı.
   * Kurulum günü 0. `null` başlangıçta -1 (henüz gün yok).
   */
  dayIndex: number;
  active: boolean;
  /** Bugün dahil kalan gün. Deneme bittiğinde 0. */
  daysLeft: number;
};

/**
 * Yerel takvim gününün sıra numarası.
 *
 * UTC gününe göre saymak YANLIŞ olurdu: TR'de (UTC+3) gece yarısından sonraki ilk
 * üç saatte UTC hâlâ dün olur, yani deneme kullanıcının gördüğü takvimden bir gün
 * geç dönerdi. `getTimezoneOffset()` yerel→UTC dakika farkını verir, geri ekleyerek
 * yerel duvar saatine çeviriyoruz.
 *
 * Bilinen kenar durum: kullanıcı deneme sırasında saat dilimi değiştirirse (yolculuk)
 * gün sayısı bir kayabilir. Spec §5.2 bunu kabul edilen risk olarak işaretledi.
 */
function localDayNumber(ts: number): number {
  const offsetMs = new Date(ts).getTimezoneOffset() * 60_000;
  return Math.floor((ts - offsetMs) / 86_400_000);
}

export function computeTrialState(startedAt: number | null, now: number): TrialState {
  if (startedAt == null) return { startedAt: null, dayIndex: -1, active: false, daysLeft: 0 };

  const dayIndex = localDayNumber(now) - localDayNumber(startedAt);

  // Negatif dayIndex = cihaz saati başlangıcın gerisine alınmış. Denemeyi bitmiş
  // saymıyoruz (kullanıcıyı cezalandırmaz) ama uzatmıyoruz da: 0. gün gibi davranır.
  const clamped = Math.max(0, dayIndex);
  const active = clamped < TRIAL_DAYS;

  return {
    startedAt,
    dayIndex: clamped,
    active,
    daysLeft: active ? TRIAL_DAYS - clamped : 0,
  };
}

export async function loadTrialStartedAt(): Promise<number | null> {
  return getJSON<number | null>(StorageKeys.trialStartedAt, null);
}

/**
 * Denemeyi başlatır. Zaten başlamışsa dokunmaz ve eski damgayı döndürür —
 * çağıranın yarışması (iki effect aynı açılışta) denemeyi sıfırlamasın.
 */
export async function startTrialIfNeeded(now: number): Promise<number> {
  const existing = await loadTrialStartedAt();
  if (existing != null) return existing;
  await setJSON(StorageKeys.trialStartedAt, now);
  return now;
}

export async function loadTrialEndedShown(): Promise<boolean> {
  return getJSON<boolean>(StorageKeys.trialEndedShown, false);
}

export async function markTrialEndedShown(): Promise<void> {
  await setJSON(StorageKeys.trialEndedShown, true);
}
