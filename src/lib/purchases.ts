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

/**
 * RevenueCat SDK'sı kullanılabilir mi (Expo Go değil + bu platform için key tanımlı).
 *
 * ⚠️ BURASI iOS'taki ŞU DAVRANIŞIN KAYNAĞI (TODO #9, iOS key'i gelene kadar açık):
 * iOS'ta key yok → `purchasesConfigured` false → `usePurchases` hiç
 * `getCustomerInfo()` çağırmaz → `customerInfo` null kalır, yani
 * `entitlementKnown` HİÇ true olmaz ve `isPro` her zaman false.
 * Sonuç: premium bir favori/söz detayı iOS'ta kalıcı olarak "kilitli" görünür ve
 * `configured` false olduğu için kilit ekranındaki "Pro'ya geç" butonu da
 * çizilmez — kullanıcı için çıkış yolu olmayan bir kilit. Yerel premium cache'i
 * silen akış bundan etkilenmez: `usePremiumCacheGuard` `configured` false iken
 * hiçbir şey yapmaz (silmez de), yani veri kaybı yok, sadece görünürlük sorunu.
 * Doğru çözüm: `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`'i EAS ortamına eklemek —
 * iOS'ta entitlement'ı istemcide taklit etmek DEĞİL.
 */
export const purchasesConfigured = nativeFeaturesAvailable && !!API_KEY;

let configured = false;

/** Idempotent — birden fazla çağrılabilir, sadece ilkinde gerçekten yapılandırır. */
export function configurePurchases(): void {
  if (!purchasesConfigured || configured) return;
  configured = true;
  Purchases.configure({ apiKey: API_KEY! });
}
