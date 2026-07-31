import { usePurchases } from '@/hooks/usePurchases';
import { useTrial } from '@/hooks/useTrial';

export type EntitlementSource = 'subscription' | 'trial' | 'none';

export type EntitlementValue = {
  /** Pro içeriğe/limitlere hakkı var mı. Abonelik VEYA aktif deneme. */
  entitled: boolean;
  source: EntitlementSource;
  /** Denemedeyse bugün dahil kalan gün; değilse 0. */
  trialDaysLeft: number;
  /**
   * Yetki GERÇEKTEN öğrenildi mi. Yıkıcı akışların (premium cache temizliği)
   * tek kapısı — bkz. `usePremiumCacheGuard`, `services/premiumCacheGuard.ts`.
   */
  entitlementKnown: boolean;
  /** RevenueCat bu platformda yapılandırıldı mı (satın alma UI'ı için). */
  purchasesConfigured: boolean;
  /** Abonelik hakkı (deneme HARİÇ) — "zaten Pro'sun" gibi metinler için. */
  isSubscribed: boolean;
  isAdsRemoved: boolean;
};

/**
 * Yetkinin TEK gerçek kaynağı.
 *
 * Neden gerekli: deneme gelince "hak var mı" sorusunun iki cevabı oldu (abonelik
 * ve aktif deneme). Her ekran bunu kendi birleştirirse biri denemeyi tanır diğeri
 * tanımaz — kullanıcı Pro yaşadığını sanırken bir ekranda kilit görür, ya da
 * tersi: ücretsiz kullanıcı premium içeriği görmeye devam eder (gelir kaçağı).
 *
 * `entitlementKnown` kuralları — sırası önemli:
 * 1. Deneme damgası diskten okunmadıysa hiçbir şey bilinmiyor. `usePurchases`
 *    "hak yok" diyor olsa bile karar VERİLEMEZ, çünkü kullanıcı denemede olabilir
 *     ve o an cache silinirse 3.325 satır uçar.
 * 2. Abonelik hakkı biliniyor ve varsa → `subscription`.
 * 3. Deneme aktifse → `trial`. RevenueCat'e hiç ihtiyaç yok: deneme tamamen
 *    yereldir, dolayısıyla `purchasesConfigured` false olan platformda (iOS,
 *    anahtar yok) bile bilinen ve geçerli bir haktır.
 * 4. Aksi halde hak yok — ama bunu ancak RevenueCat gerçekten cevap verdiyse
 *    "biliyoruz" sayarız.
 */
export function useEntitlement(): EntitlementValue {
  const { configured, entitlementKnown: purchasesKnown, isPro, isAdsRemoved } = usePurchases();
  const { loaded: trialLoaded, active: trialActive, daysLeft } = useTrial();

  const subscriptionKnown = configured && purchasesKnown;

  if (!trialLoaded) {
    return {
      entitled: false,
      source: 'none',
      trialDaysLeft: 0,
      entitlementKnown: false,
      purchasesConfigured: configured,
      isSubscribed: false,
      isAdsRemoved,
    };
  }

  if (subscriptionKnown && isPro) {
    return {
      entitled: true,
      source: 'subscription',
      trialDaysLeft: 0,
      entitlementKnown: true,
      purchasesConfigured: configured,
      isSubscribed: true,
      isAdsRemoved,
    };
  }

  if (trialActive) {
    return {
      entitled: true,
      source: 'trial',
      trialDaysLeft: daysLeft,
      entitlementKnown: true,
      purchasesConfigured: configured,
      isSubscribed: false,
      isAdsRemoved,
    };
  }

  return {
    entitled: false,
    source: 'none',
    trialDaysLeft: 0,
    entitlementKnown: subscriptionKnown,
    purchasesConfigured: configured,
    isSubscribed: false,
    isAdsRemoved,
  };
}
