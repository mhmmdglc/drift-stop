import { useEffect } from 'react';

import { usePurchases } from '@/hooks/usePurchases';
import { useSettings } from '@/hooks/useSettings';
import { FREE_FREQUENCY_MAX } from '@/types/settings';

/**
 * Pro'ya özel ayarları ücretsiz kullanıcıda geri çeker (ör. abonelik bitince
 * frequency 10'da kalmasın). Satın almalar bu platformda yapılandırılmamışsa
 * hiçbir şey yapmaz; entitlement bilgisi yüklenmeden (loading) da dokunmaz ki
 * gerçek Pro kullanıcı açılışta yanlışlıkla düşürülmesin.
 */
export function useEnforceFreeLimits(): void {
  const { configured, loading, isPro } = usePurchases();
  const { settings, update } = useSettings();

  useEffect(() => {
    if (!configured || loading || isPro) return;
    if (settings.frequency > FREE_FREQUENCY_MAX) {
      update({ frequency: FREE_FREQUENCY_MAX });
    }
  }, [configured, loading, isPro, settings.frequency, update]);
}
