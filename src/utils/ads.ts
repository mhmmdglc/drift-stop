import Constants from 'expo-constants';
import * as TrackingTransparency from 'expo-tracking-transparency';
import { Platform } from 'react-native';
import mobileAds, { AdEventType, InterstitialAd } from 'react-native-google-mobile-ads';

import { AdUnits } from '@/constants/adUnits';

/**
 * Expo Go'da native reklam modülü yoktur → reklamlar devre dışı.
 * Development/production build'de aktif.
 *
 * ⚠️ iOS v1'de reklam KAPALI. Sebebi: AdMob yayıncı hesabı
 * (ca-app-pub-3817081931651779) politika ihlali nedeniyle kapatıldı, dolayısıyla
 * iOS reklam birimleri hiç oluşturulamadı. Birim ID'si boş kalınca `AdUnits`
 * Google'ın TestIds'ine düşüyor — release'de gerçek kullanıcıya test reklamı
 * göstermek başlı başına politika ihlali, o yüzden platformu tamamen kapatıyoruz.
 * ATT istemi de buna bağlı: `initAds` erken döndüğü için iOS'ta izin sorulmuyor.
 * Hesap itirazı sonuçlanıp iOS birimleri açılınca burayı geri al.
 */
export const adsEnabled = Constants.appOwnership !== 'expo' && Platform.OS !== 'ios';

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

/**
 * iOS'ta ATT izni verilmediyse Apple kişiselleştirilmiş reklamı yasaklıyor.
 * İzin verilirse kişiselleştirilmiş reklama geçiyoruz — eCPM farkı büyük,
 * o yüzden bayrağı gerçekten reklam isteklerine yansıtıyoruz (sabit true değil).
 * Varsayılan false: izin bilinmeden önce her zaman güvenli taraf.
 */
let personalizedAds = false;
const personalizationListeners = new Set<() => void>();

export function getPersonalizedAds(): boolean {
  return personalizedAds;
}

/** `useSyncExternalStore` için — izin çözülünce açık banner'ların yeniden istek yapması gerekir. */
export function subscribeToAdPersonalization(listener: () => void): () => void {
  personalizationListeners.add(listener);
  return () => {
    personalizationListeners.delete(listener);
  };
}

function setPersonalizedAds(next: boolean): void {
  if (personalizedAds === next) return;
  personalizedAds = next;
  personalizationListeners.forEach((listener) => listener());
}

/**
 * ATT iznini çöz. Sadece iOS 14+'ta anlamlı; Android ve eski iOS'ta
 * `isAvailable()` false döner ve hiç sormayız.
 */
async function resolveTrackingPermission(): Promise<void> {
  if (Platform.OS !== 'ios' || !TrackingTransparency.isAvailable()) return;
  try {
    const current = await TrackingTransparency.getTrackingPermissionsAsync();
    // Sistem diyaloğu ömür boyu bir kez gösterilir; zaten cevaplanmışsa tekrar sorma.
    const resolved =
      current.status === 'undetermined' && current.canAskAgain
        ? await TrackingTransparency.requestTrackingPermissionsAsync()
        : current;
    setPersonalizedAds(resolved.granted);
  } catch {
    // İzin çözülemediyse kişiselleştirme yok — reklamsız kalmaktansa NPA ile devam.
    setPersonalizedAds(false);
  }
}

export function preloadInterstitial(): void {
  if (!adsEnabled || adsSuppressed) return;
  interstitial = InterstitialAd.createForAdRequest(AdUnits.interstitial, {
    requestNonPersonalizedAdsOnly: !personalizedAds,
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
  // ATT izni SDK başlatılmadan ÖNCE çözülmeli: aksi halde ilk reklam isteği
  // izin bilinmeden gider ve o gösterim kalıcı olarak kişiselleştirilmemiş sayılır.
  void resolveTrackingPermission()
    .then(() => mobileAds().initialize())
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
