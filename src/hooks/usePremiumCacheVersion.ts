import { useSyncExternalStore } from 'react';

import {
  getPremiumCacheVersion,
  subscribePremiumCacheVersion,
} from '@/services/premiumCacheGuard';

/**
 * Yerel premium cache'i okuyan ekranların `useMemo` bağımlılığı olarak kullandığı
 * sürüm sayacı. `usePacks`'teki `version` state'iyle aynı fikir; burada mutasyon
 * (temizlik/geri yükleme) React ağacının dışında, `services/premiumCacheGuard`
 * içinde olduğu için sayaç modül seviyesinde tutulup abonelikle dağıtılıyor.
 *
 * Neden şart: satın alma sonrası `isPro` anında true olur, satırlar 2-5 sn sonra
 * gelir. Bu sinyal olmadan `[ids, isPro]`'ya bağlı bir memo bir daha hiç
 * hesaplanmaz ve ödeme yapan kullanıcı kilidi görmeye devam eder.
 */
export function usePremiumCacheVersion(): number {
  return useSyncExternalStore(
    subscribePremiumCacheVersion,
    getPremiumCacheVersion,
    // Sunucu tarafı render yok (RN), ama useSyncExternalStore imzası istiyor.
    getPremiumCacheVersion
  );
}
