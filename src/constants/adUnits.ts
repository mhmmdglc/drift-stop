import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

/**
 * Gerçek reklam birimi ID'leri — CANLIYA ALMADAN ÖNCE doldur.
 * Boş bırakılırsa (ve __DEV__ ise) Google'ın TEST birimleri kullanılır.
 */
const REAL = {
  bannerAndroid: 'ca-app-pub-3817081931651779/3409885671',
  bannerIos: '',
  interstitialAndroid: 'ca-app-pub-3817081931651779/3532753144',
  interstitialIos: '',
};

const realPick = (android: string, ios: string): string =>
  (Platform.select({ android, ios, default: '' }) ?? '');

export const AdUnits = {
  banner:
    !__DEV__ && realPick(REAL.bannerAndroid, REAL.bannerIos)
      ? realPick(REAL.bannerAndroid, REAL.bannerIos)
      : TestIds.BANNER,
  interstitial:
    !__DEV__ && realPick(REAL.interstitialAndroid, REAL.interstitialIos)
      ? realPick(REAL.interstitialAndroid, REAL.interstitialIos)
      : TestIds.INTERSTITIAL,
};

/** Kaç swipe'ta bir interstitial denensin (ayrıca min 4dk arayla — bkz. utils/ads.ts). */
export const INTERSTITIAL_EVERY = 12;
