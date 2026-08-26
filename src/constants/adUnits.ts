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
 *
 * ⚠️⚠️ HER BİRİ **DÜZ, STATİK** `process.env.EXPO_PUBLIC_…` OLARAK YAZILMALI.
 * Burada bir zamanlar `const env = (key) => process.env[key]` yardımcı işlevi
 * vardı ve **hiçbir reklam birimi paketin içine girmiyordu**: `babel-preset-expo`
 * yalnızca statik üye erişimini (`process.env.X`) derleme anında değerle
 * değiştiriyor, hesaplanmış erişimi (`process.env[key]`) olduğu gibi bırakıyor.
 * Cihazda `process.env` diye bir şey olmadığı için değer `undefined` kalıyor,
 * `resolveUnit` `null` dönüyor ve uygulama sessizce **tek bir reklam bile
 * göstermiyordu**. Testler yeşildi (jest gerçek `process.env`i okur, Babel
 * dönüşümü çalışmaz), EAS build logu da dört değişkeni "yüklendi" diye yazıyordu.
 * Tek kanıt derlenmiş paketti: 2026-08-24'te `.aab` içindeki Hermes paketinde
 * birim id'lerinin hiç geçmediği görüldü. `noDynamicEnvAccess.test.ts` bekçisi.
 */
const REAL = {
  bannerAndroid: (process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID ?? '').trim(),
  bannerIos: (process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS ?? '').trim(),
  interstitialAndroid: (process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID ?? '').trim(),
  interstitialIos: (process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS ?? '').trim(),
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
