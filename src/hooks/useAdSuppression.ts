import { useEffect } from 'react';

import { useEntitlement } from '@/hooks/useEntitlement';
import { setAdsSuppressed } from '@/utils/ads';

/**
 * Reklam bastırmayı yetkiye bağlar.
 *
 * Neden `PurchasesProvider` içinde DEĞİL: orada yalnızca `isAdsRemoved` biliniyor,
 * deneme bilinmiyor. Deneme "tam Pro" demek ve reklamsızlık onun en görünür parçası
 * — `PurchasesProvider`'da kalan sürüm, denemedeki kullanıcıya banner ve geçiş
 * reklamı göstermeye devam ederdi.
 *
 * `setAdsSuppressed` modül seviyesinde bir bayrak; banner DIŞINDAKİ reklamları
 * (geçiş reklamı) da kapatan tek yer o, o yüzden bayrağı yazmak banner'ı gizlemekle
 * aynı şey değil — ikisi de gerekiyor (bkz. `AdBanner.tsx`, `utils/ads.ts`).
 */
export function useAdSuppression(): void {
  const { entitled, isAdsRemoved } = useEntitlement();

  useEffect(() => {
    setAdsSuppressed(entitled || isAdsRemoved);
  }, [entitled, isAdsRemoved]);
}
