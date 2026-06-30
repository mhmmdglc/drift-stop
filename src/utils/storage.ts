import AsyncStorage from '@react-native-async-storage/async-storage';

/** Tüm AsyncStorage anahtarları tek yerde. */
export const StorageKeys = {
  favorites: 'driftstop:favorites',
  settings: 'driftstop:settings',
  onboardingComplete: 'driftstop:onboardingComplete',
  lastScheduledDate: 'driftstop:lastScheduledDate',
  scheduledQuoteIds: 'driftstop:scheduledQuoteIds',
  seenToday: 'driftstop:seenToday',
  themeMode: 'driftstop:themeMode',
  widgetQuoteId: 'driftstop:widgetQuoteId',
  seenHistory: 'driftstop:seenHistory',
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
