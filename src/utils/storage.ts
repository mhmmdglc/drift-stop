import AsyncStorage from '@react-native-async-storage/async-storage';

/** Tüm AsyncStorage anahtarları tek yerde. */
export const StorageKeys = {
  favorites: 'driftstop:favorites',
  settings: 'driftstop:settings',
  onboardingComplete: 'driftstop:onboardingComplete',
  lastScheduledDate: 'driftstop:lastScheduledDate',
  scheduledQuoteIds: 'driftstop:scheduledQuoteIds',
  // NOT: burada `seenToday` ve `themeMode` vardı; ikisi de hiçbir yerden
  // okunmuyor/yazılmıyordu. Tema tercihi `settings` içinde tutuluyor.
  widgetQuoteId: 'driftstop:widgetQuoteId',
  seenHistory: 'driftstop:seenHistory',
  /** Kartsız 7 günlük denemenin başlangıç damgası (epoch ms). Bkz. services/trial.ts */
  trialStartedAt: 'driftstop:trialStartedAt',
  /** `/trial-ended` ekranı bir kez gösterildi mi. */
  trialEndedShown: 'driftstop:trialEndedShown',
} as const;

export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sessizce geç — kalıcılık kritik değil
  }
}
