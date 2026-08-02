import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

/**
 * Reklam birimi ID'leri.
 *
 * ⚠️ `EXPO_PUBLIC_*` değerleri DERLEME ANINDA JS paketine gömülür; cihazda
 * çalışma anında okunmazlar. Yani bunları değiştirmek **yeni bir build**
 * gerektirir (EAS Update kurulu değil). AdMob **App ID**'si ise daha da katı:
 * `app.json` üzerinden `AndroidManifest.xml` ve `Info.plist`e giriyor, yani
 * native config — OTA olsa bile build gerektirir.
 *
 * Test/production ayrımı bu yüzden env ile DEĞİL, `__DEV__` ile yapılıyor:
 * geliştirme derlemeleri her zaman Google'ın resmî test birimlerini kullanır,
 * yayın derlemeleri her zaman gerçek birimleri. Aradaki geçiş için env
 * değiştirmeye gerek yok — cihazında test reklamı görmek istersen AdMob'da
 * cihazını "test device" olarak kaydet, gerçek birim id'leriyle test reklamı
 * alırsın.
 */
const env = (key: string): string => (process.env[key] ?? '').trim();

const REAL = {
  bannerAndroid: env('EXPO_PUBLIC_ADMOB_BANNER_ANDROID'),
  bannerIos: env('EXPO_PUBLIC_ADMOB_BANNER_IOS'),
  interstitialAndroid: env('EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID'),
  interstitialIos: env('EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS'),
};

const pick = (android: string, ios: string): string =>
  Platform.select({ android, ios, default: '' }) ?? '';

/**
 * Yayın derlemesinde gerçek birim id'si yoksa reklam GÖSTERİLMEZ.
 *
 * Eskiden bu durumda Google'ın `TestIds`'ine düşülüyordu — yani id'yi doldurmayı
 * unutmak, gerçek kullanıcılara test reklamı göstermek demekti. Bu bir AdMob
 * politika ihlali ve hesabın kapanma sebebi; sessizce olması da cabası. iOS
 * birimleri şu an boş olduğu için bu dal teorik değil, canlı bir risk.
 */
function resolveUnit(android: string, ios: string, testId: string): string | null {
  if (__DEV__) return testId;
  const real = pick(android, ios);
  return real.length > 0 ? real : null;
}

export const AdUnits = {
  banner: resolveUnit(REAL.bannerAndroid, REAL.bannerIos, TestIds.BANNER),
  interstitial: resolveUnit(REAL.interstitialAndroid, REAL.interstitialIos, TestIds.INTERSTITIAL),
};

/** Bu platformda gösterilebilecek gerçek (ya da dev'de test) birim var mı. */
export const hasBannerUnit = AdUnits.banner != null;
export const hasInterstitialUnit = AdUnits.interstitial != null;

/** Kaç swipe'ta bir interstitial denensin (ayrıca min 4dk arayla — bkz. utils/ads.ts). */
export const INTERSTITIAL_EVERY = 12;
