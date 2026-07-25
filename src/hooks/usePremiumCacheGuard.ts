import { useEffect } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { usePurchases } from '@/hooks/usePurchases';
import {
  reconcilePremiumCache,
  type PremiumEntitlementState,
} from '@/services/premiumCacheGuard';

/**
 * Geri yükleme yeniden deneme gecikmeleri (ms). RevenueCat istemcide hakkı anında
 * açar, ama premium satırları RLS'e göre indirebilmek için `profiles.is_premium`'un
 * `revenuecat-webhook` tarafından yazılmış olması gerekir — bu birkaç saniye
 * sürebilir. İlk deneme başarısızsa kısa aralıklarla tekrar denenir; hepsi
 * başarısız olursa bir sonraki açılışta (bu hook yeniden mount olduğunda) devam eder.
 */
const RESTORE_RETRY_DELAYS_MS = [3000, 8000, 20000];

/**
 * Premium yerel cache'ini entitlement ile hizalı tutar (bkz.
 * `src/services/premiumCacheGuard.ts`).
 *
 * Korumalar:
 * - `!configured` → satın almalar bu platformda hiç yapılandırılmamış (Expo Go /
 *   iOS anahtarı yok, bkz. `lib/purchases.ts`); entitlement hakkında hiçbir şey
 *   bilinmiyor, karar verilemez.
 * - `!entitlementKnown` → RevenueCat `customerInfo` elimizde DEĞİL. Burada
 *   `!loading` KULLANILMAZ: `loading` `getCustomerInfo()` REDDEDİLDİĞİNDE de
 *   kapanır (çevrimdışı ilk açılış, silinmiş uygulama verisi, bozuk RC cache'i) ve
 *   o anda `isPro` false görünür. `loading`e bakan bir sürüm, ödeme YAPAN
 *   kullanıcının 3.325 satırını + mezar taşlarını her başarısız soğuk açılışta
 *   silerdi (geri getirmek ağ gerektirir). Servis tarafı bu kuralı tipte de
 *   zorunlu kılıyor: 'unknown' geçilirse hiçbir şey yapmaz.
 * - `isPro && !user` → hak var ama oturum yok (RevenueCat anonim satın alma).
 *   RLS gereği premium satırlar oturumsuz indirilemez; boşuna denemeyiz. Silme de
 *   gerekmez (hak duruyor). Oturum açıldığında effect yeniden çalışır.
 */
export function usePremiumCacheGuard(): void {
  const { configured, entitlementKnown, isPro } = usePurchases();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!configured || !entitlementKnown) return;
    if (isPro && !userId) return;

    const entitlement: PremiumEntitlementState = isPro ? 'entitled' : 'none';

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const run = async () => {
      // `isCancelled`: uçuşta olan geri yükleme (2-5 sn) bu effect temizlendikten
      // sonra satır YAZMAMALI — çıkış yapıldığında `signOut` cache'i temizliyor,
      // gecikmiş bir upsert temizliğin üstüne yazardı (üstelik mezar taşlarını da silerdi).
      const result = await reconcilePremiumCache(entitlement, { isCancelled: () => cancelled });
      if (cancelled) return;
      if (result.action === 'restore-pending' && attempt < RESTORE_RETRY_DELAYS_MS.length) {
        timer = setTimeout(() => void run(), RESTORE_RETRY_DELAYS_MS[attempt]);
        attempt += 1;
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [configured, entitlementKnown, isPro, userId]);
}
