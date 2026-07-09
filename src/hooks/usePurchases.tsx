import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

import { configurePurchases, purchasesConfigured } from '@/lib/purchases';
import { setAdsSuppressed } from '@/utils/ads';

const PRO_ENTITLEMENT = 'pro';
const NO_ADS_ENTITLEMENT = 'no_ads';

type PurchaseResult = { error: string | null; cancelled?: boolean };

type PurchasesContextValue = {
  /** RevenueCat yapılandırılmamışsa (key yok/Expo Go) her zaman false. */
  configured: boolean;
  loading: boolean;
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
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);

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

    Promise.all([Purchases.getCustomerInfo(), Purchases.getOfferings()])
      .then(([info, offerings]) => {
        if (!active) return;
        setCustomerInfo(info);
        setOffering(offerings.current);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  const { isPro, isAdsRemoved } = useMemo(() => deriveFlags(customerInfo), [customerInfo]);

  useEffect(() => {
    setAdsSuppressed(isAdsRemoved);
  }, [isAdsRemoved]);

  const value = useMemo<PurchasesContextValue>(
    () => ({
      configured: purchasesConfigured,
      loading,
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
    [loading, isPro, isAdsRemoved, offering]
  );

  return <PurchasesContext.Provider value={value}>{children}</PurchasesContext.Provider>;
}

export function usePurchases(): PurchasesContextValue {
  const ctx = useContext(PurchasesContext);
  if (!ctx) throw new Error('usePurchases, PurchasesProvider içinde kullanılmalı.');
  return ctx;
}
