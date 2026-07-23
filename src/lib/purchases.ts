import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

import { nativeFeaturesAvailable } from '@/utils/runtime';

// Platforma göre doğru RevenueCat key'i: Android key'i iOS'a verilirse SDK
// "invalid API key" hatası fırlatıyor — iOS key'i tanımlanana kadar iOS'ta
// satın almalar kapalı kalır (paywall/premium UI zaten purchasesConfigured'a bakıyor).
const API_KEY = Platform.select({
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
});

/** RevenueCat SDK'sı kullanılabilir mi (Expo Go değil + bu platform için key tanımlı). */
export const purchasesConfigured = nativeFeaturesAvailable && !!API_KEY;

let configured = false;

/** Idempotent — birden fazla çağrılabilir, sadece ilkinde gerçekten yapılandırır. */
export function configurePurchases(): void {
  if (!purchasesConfigured || configured) return;
  configured = true;
  Purchases.configure({ apiKey: API_KEY! });
}
