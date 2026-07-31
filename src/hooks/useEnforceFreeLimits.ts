import { useEffect } from 'react';

import { useEntitlement } from '@/hooks/useEntitlement';
import { useSettings } from '@/hooks/useSettings';
import { FREE_FREQUENCY_MAX } from '@/types/settings';

/**
 * Pro'ya özel ayarları hakkı olmayan kullanıcıda geri çeker (ör. abonelik ya da
 * deneme bitince frequency 10'da kalmasın).
 *
 * Yetki `useEntitlement`ten okunuyor: `isPro`ya bakan sürüm, DENEMEDEKİ
 * kullanıcının 10'a çektiği frekansı her açılışta 3'e düşürürdü — deneme "tam Pro"
 * demek, bildirim sayısı da onun parçası. `entitlementKnown` beklenmeden hareket
 * edilmez ki gerçek Pro kullanıcı soğuk açılışta yanlışlıkla düşürülmesin.
 */
export function useEnforceFreeLimits(): void {
  const { entitled, entitlementKnown } = useEntitlement();
  const { settings, update } = useSettings();

  useEffect(() => {
    if (!entitlementKnown || entitled) return;
    if (settings.frequency > FREE_FREQUENCY_MAX) {
      update({ frequency: FREE_FREQUENCY_MAX });
    }
  }, [entitlementKnown, entitled, settings.frequency, update]);
}
