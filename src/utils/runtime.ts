import Constants from 'expo-constants';

/**
 * Expo Go mu? Expo Go'da native modüller (expo-notifications/Android, AdMob, widget) yoktur.
 * Bu durumda ilgili özellikler sessizce devre dışı kalır; uygulama çökmez.
 * Development/production build'de false → tüm özellikler aktif.
 */
export const isExpoGo = Constants.appOwnership === 'expo';

/** Native özellikler (bildirim/reklam/widget) bu ortamda kullanılabilir mi? */
export const nativeFeaturesAvailable = !isExpoGo;
