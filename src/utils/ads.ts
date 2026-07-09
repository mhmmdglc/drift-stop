import Constants from 'expo-constants';
import mobileAds, { AdEventType, InterstitialAd } from 'react-native-google-mobile-ads';

import { AdUnits } from '@/constants/adUnits';

/**
 * Expo Go'da native reklam modülü yoktur → reklamlar devre dışı.
 * Development/production build'de aktif.
 */
export const adsEnabled = Constants.appOwnership !== 'expo';

/** İki interstitial arasında en az bu kadar süre olsun (kullanıcıyı darlamamak için). */
const MIN_INTERSTITIAL_GAP_MS = 4 * 60 * 1000; // 4 dakika

let interstitial: InterstitialAd | null = null;
let isLoaded = false;
let lastShownAt = 0;

/** "no_ads" entitlement'ı (remove_ads satın alımı ya da Pro abonelik) aktifse true. */
let adsSuppressed = false;

/** usePurchases hook'u tarafından entitlement değiştikçe çağrılır. */
export function setAdsSuppressed(suppressed: boolean): void {
  adsSuppressed = suppressed;
}

export function preloadInterstitial(): void {
  if (!adsEnabled || adsSuppressed) return;
  interstitial = InterstitialAd.createForAdRequest(AdUnits.interstitial, {
    requestNonPersonalizedAdsOnly: true,
  });
  interstitial.addAdEventListener(AdEventType.LOADED, () => {
    isLoaded = true;
  });
  interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    isLoaded = false;
    preloadInterstitial(); // gösterdikten sonra bir sonrakini ön-yükle
  });
  interstitial.addAdEventListener(AdEventType.ERROR, () => {
    isLoaded = false;
  });
  interstitial.load();
}

/** Reklam SDK'sını başlat ve ilk interstitial'ı ön-yükle. */
export function initAds(): void {
  if (!adsEnabled || adsSuppressed) return;
  lastShownAt = Date.now(); // açılıştan sonra ilk birkaç dakika reklamsız (es geçme süresi)
  mobileAds()
    .initialize()
    .then(() => preloadInterstitial())
    .catch(() => {});
}

/**
 * Hazırsa VE son interstitial'dan bu yana yeterli süre geçtiyse göster.
 * true = gösterildi. Sık göstermeyi engeller → kullanıcıyı darlamaz.
 */
export function showInterstitialIfReady(): boolean {
  if (!adsEnabled || adsSuppressed || !interstitial || !isLoaded) return false;
  if (Date.now() - lastShownAt < MIN_INTERSTITIAL_GAP_MS) return false;
  try {
    interstitial.show();
    lastShownAt = Date.now();
    return true;
  } catch {
    return false;
  }
}
