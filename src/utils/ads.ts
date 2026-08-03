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

/** İki interstitial ARASINDA en az bu kadar süre olsun (kullanıcıyı darlamamak için). */
const MIN_INTERSTITIAL_GAP_MS = 4 * 60 * 1000; // 4 dakika
/**
 * Açılıştan sonraki bu süre boyunca geçiş reklamı gösterilmez.
 *
 * Eskiden ayrı bir kavram DEĞİLDİ: `initAds` doğrudan `lastShownAt = Date.now()`
 * yazıyordu, yani "iki reklam arası" 4 dakikalık aralık uygulama AÇILIŞINDAN
 * itibaren işliyordu. 12 kaydırma eşiğiyle birleşince tipik bir oturumda geçiş
 * reklamı hiç çıkmıyordu — doğrudan gelir kaybı. İkisi artık ayrı.
 */
const STARTUP_GRACE_MS = 60 * 1000;

let interstitial: InterstitialAd | null = null;
let isLoaded = false;
let lastShownAt = 0;
let startedAt = 0;

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
  // Yayın derlemesinde gerçek birim id'si yoksa interstitial hiç kurulmaz
  // (test reklamının canlıya sızmaması için — bkz. constants/adUnits.ts).
  if (!AdUnits.interstitial) return;
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

/**
 * Test cihazı kimlikleri (virgülle ayrılmış). Bu cihazlar GERÇEK birim id'leriyle
 * ama TEST reklamı alır.
 *
 * Neden gerekli: kapalı testte 12 kişi uygulamayı gezerken gerçek birim id'leri
 * gerçek gösterim ve tıklama üretir. Bu "geçersiz trafik" sayılır ve yayıncı
 * hesabını kapatır — bu projenin ÖNCEKİ AdMob hesabı zaten kapatıldı, yenisinin
 * hiç geçmişi yok. Kendi cihazlarını burada kaydetmek, kurulumu doğrularken
 * hesabı riske atmamanın Google'ın önerdiği yolu.
 *
 * Cihaz kimliği uygulama ilk açıldığında logcat'e yazılır:
 *   `Use RequestConfiguration.Builder.setTestDeviceIds(Arrays.asList("33BE..."))`
 */
const TEST_DEVICE_IDS = (process.env.EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Reklam SDK'sını başlat ve ilk interstitial'ı ön-yükle. */
export function initAds(): void {
  if (!adsEnabled || adsSuppressed) return;
  startedAt = Date.now(); // açılıştan hemen sonra reklam yok (bkz. STARTUP_GRACE_MS)
  // ATT izni SDK başlatılmadan ÖNCE çözülmeli: aksi halde ilk reklam isteği
  // izin bilinmeden gider ve o gösterim kalıcı olarak kişiselleştirilmemiş sayılır.
  // Test cihazı listesi de initialize'dan ÖNCE yazılmalı — sonrasında yazılırsa
  // ilk istek (ve preload edilen interstitial) gerçek reklam olarak gider.
  void resolveTrackingPermission()
    .then(() =>
      TEST_DEVICE_IDS.length > 0
        ? mobileAds().setRequestConfiguration({ testDeviceIdentifiers: TEST_DEVICE_IDS })
        : undefined
    )
    .then(() => mobileAds().initialize())
    .then(() => preloadInterstitial())
    .catch(() => {});
}

/**
 * Zaman kapılarının SAF kararı — native'e dokunmadan test edilebilsin diye ayrı.
 *
 * `lastShownAt === 0` "bu oturumda hiç reklam gösterilmedi" demek; o durumda
 * yalnızca açılış payı geçerli. Aksi halde son reklamdan bu yana geçen süre.
 */
export function isInterstitialTimeAllowed(now: number, started: number, lastShown: number): boolean {
  if (started > 0 && now - started < STARTUP_GRACE_MS) return false;
  if (lastShown > 0 && now - lastShown < MIN_INTERSTITIAL_GAP_MS) return false;
  return true;
}

/**
 * Hazırsa VE zaman kapıları izin veriyorsa göster.
 * true = gösterildi. Çağıran (`(tabs)/index.tsx`) false dönüşünde kaydırma
 * sayacını SIFIRLAMAZ, böylece bir sonraki kaydırmada tekrar denenir.
 */
export function showInterstitialIfReady(): boolean {
  if (!adsEnabled || adsSuppressed || !interstitial || !isLoaded) return false;
  if (!isInterstitialTimeAllowed(Date.now(), startedAt, lastShownAt)) return false;
  try {
    interstitial.show();
    lastShownAt = Date.now();
    return true;
  } catch {
    return false;
  }
}
