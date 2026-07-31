import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

import { configurePurchases, purchasesConfigured } from '@/lib/purchases';
import { useAuth } from '@/hooks/useAuth';

const PRO_ENTITLEMENT = 'pro';
const NO_ADS_ENTITLEMENT = 'no_ads';

type PurchaseResult = { error: string | null; cancelled?: boolean };

type PurchasesContextValue = {
  /** RevenueCat yapılandırılmamışsa (key yok/Expo Go) her zaman false. */
  configured: boolean;
  loading: boolean;
  /**
   * Entitlement durumu GERÇEKTEN öğrenildi mi (`customerInfo` elimizde mi).
   *
   * `!loading` ile AYNI ŞEY DEĞİL: `loading` bir `.finally()` içinde kapanır,
   * yani `getCustomerInfo()` REDDEDİLDİĞİNDE de false olur — o durumda
   * `customerInfo` null, `isPro` false kalır ama hiçbir şey öğrenilmemiştir
   * (ilk açılış çevrimdışı, uygulama verisi silinmiş, bozuk RC cache'i...).
   * Bu ayrım yıkıcı akışlar için kritik: `loading`e bakıp silmeye kalkan bir
   * kod, ödeme YAPAN kullanıcının 3.325 satırlık premium cache'ini soğuk
   * açılışta uçurur (bkz. `services/premiumCacheGuard.ts`). Kilit/açık gibi
   * geri alınabilir UI kararları `loading` + `isPro` ile verilebilir; veri
   * silen kararlar SADECE bu bayrak true iken verilir.
   *
   * ⚠️ iOS'ta `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` olmadığı için
   * `configured` false ve bu bayrak hiç true olmaz (bkz. `lib/purchases.ts`,
   * TODO #9) — bu yüzden yıkıcı akışlar `configured`'ı da kontrol eder.
   */
  entitlementKnown: boolean;
  isPro: boolean;
  isAdsRemoved: boolean;
  offering: PurchasesOffering | null;
  purchasePackage: (pkg: PurchasesPackage) => Promise<PurchaseResult>;
  restorePurchases: () => Promise<PurchaseResult>;
};

const PurchasesContext = createContext<PurchasesContextValue | null>(null);

function deriveFlags(info: CustomerInfo | null) {
  return {
    isPro: !!info?.entitlements.active[PRO_ENTITLEMENT],
    isAdsRemoved: !!info?.entitlements.active[NO_ADS_ENTITLEMENT],
  };
}

export function PurchasesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const linkedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!purchasesConfigured) {
      setLoading(false);
      return;
    }
    configurePurchases();

    let active = true;
    const listener = (info: CustomerInfo) => {
      if (active) setCustomerInfo(info);
    };
    Purchases.addCustomerInfoUpdateListener(listener);

    Purchases.getCustomerInfo()
      .then((info) => {
        if (active) setCustomerInfo(info);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    // Ayrı tutuluyor: offerings (RevenueCat dashboard'da yapılandırılmamışsa
    // ya da cihazda Play Billing kullanılamıyorsa) hata verebilir — bu, customerInfo'nun
    // (yani isPro/isAdsRemoved'ın) güncellenmesini asla engellememeli.
    Purchases.getOfferings()
      .then((offerings) => {
        if (active) setOffering(offerings.current);
      })
      .catch(() => {});

    return () => {
      active = false;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  // RevenueCat'in app_user_id'sini Supabase kullanıcı id'sine bağlar/çözer.
  // Webhook'un (Faz 4) hangi profiles satırını güncelleyeceğini bilmesi için şart —
  // bağlanmazsa RevenueCat anonim bir id kullanır ve profiles.is_premium hiç yazılamaz.
  useEffect(() => {
    if (!purchasesConfigured) return;
    const nextId = user?.id ?? null;
    if (nextId === linkedUserId.current) return;
    const prevId = linkedUserId.current;
    linkedUserId.current = nextId;

    if (nextId) {
      Purchases.logIn(nextId)
        .then(({ customerInfo: info }) => setCustomerInfo(info))
        .catch(() => {});
    } else if (prevId) {
      Purchases.logOut()
        .then((info) => setCustomerInfo(info))
        .catch(() => {});
    }
  }, [user]);

  const { isPro, isAdsRemoved } = useMemo(() => deriveFlags(customerInfo), [customerInfo]);

  // NOT: `setAdsSuppressed` çağrısı burada DEĞİL, `useAdSuppression`'da.
  // Buradan yazılan sürüm denemeyi göremiyordu (deneme yerel, RevenueCat'te karşılığı
  // yok) ve denemedeki kullanıcıya reklam göstermeye devam ediyordu.

  const value = useMemo<PurchasesContextValue>(
    () => ({
      configured: purchasesConfigured,
      loading,
      // customerInfo null iken entitlement hakkında hiçbir şey bilmiyoruz.
      entitlementKnown: customerInfo != null,
      isPro,
      isAdsRemoved,
      offering,
      purchasePackage: async (pkg) => {
        try {
          const { customerInfo: info } = await Purchases.purchasePackage(pkg);
          setCustomerInfo(info);
          return { error: null };
        } catch (e) {
          const err = e as { userCancelled?: boolean; message?: string };
          if (err.userCancelled) return { error: null, cancelled: true };
          return { error: err.message ?? 'purchases.errors.generic' };
        }
      },
      restorePurchases: async () => {
        try {
          const info = await Purchases.restorePurchases();
          setCustomerInfo(info);
          return { error: null };
        } catch (e) {
          const err = e as { message?: string };
          return { error: err.message ?? 'purchases.errors.generic' };
        }
      },
    }),
    [loading, customerInfo, isPro, isAdsRemoved, offering]
  );

  return <PurchasesContext.Provider value={value}>{children}</PurchasesContext.Provider>;
}

export function usePurchases(): PurchasesContextValue {
  const ctx = useContext(PurchasesContext);
  if (!ctx) throw new Error('usePurchases, PurchasesProvider içinde kullanılmalı.');
  return ctx;
}
