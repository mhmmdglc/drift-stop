import Purchases from 'react-native-purchases';

import { nativeFeaturesAvailable } from '@/utils/runtime';

const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

/** RevenueCat SDK'sı kullanılabilir mi (Expo Go değil + key tanımlı). */
export const purchasesConfigured = nativeFeaturesAvailable && !!ANDROID_API_KEY;

let configured = false;

/** Idempotent — birden fazla çağrılabilir, sadece ilkinde gerçekten yapılandırır. */
export function configurePurchases(): void {
  if (!purchasesConfigured || configured) return;
  configured = true;
  Purchases.configure({ apiKey: ANDROID_API_KEY! });
}
