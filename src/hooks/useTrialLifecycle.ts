import { useEffect, useRef, useState } from 'react';

import { useEntitlement } from '@/hooks/useEntitlement';
import { useSettings } from '@/hooks/useSettings';
import { useTrial } from '@/hooks/useTrial';
import { clearTrialNotices, scheduleTrialNotices } from '@/services/trialNotifications';
import { FREE_FREQUENCY_MAX } from '@/types/settings';
import { applySchedule } from '@/utils/scheduler';

/**
 * Denemenin yaşam döngüsü: ön bilgilendirme uyarılarını kurar ve deneme bitince
 * spec §5.3'teki sırayı uygular.
 *
 * Bitişte sıra ÖNEMLİ:
 *   1. `frequency > 3` ise 3'e indir
 *   2. bildirimleri YENİ frekansla yeniden planla
 *   3. `/trial-ended` ekranını bir kez göster
 *
 * 2'yi 1'den önce yapmak, kullanıcıya deneme bittikten sonra günde 10 bildirim
 * göndermeye devam etmek demekti: `applySchedule` çağrıldığı andaki `settings`i
 * okuyor ve plan 3 gün ileriye kuruluyor. `useEnforceFreeLimits` de frekansı
 * indiriyor ama onun ne zaman biteceğine güvenmiyoruz — burada indirilmiş değeri
 * `applySchedule`a doğrudan geçiriyoruz.
 *
 * Premium önbelleğin temizliği bu hook'ta DEĞİL: `usePremiumCacheGuard` yetki
 * false'a düştüğü an kendiliğinden yapıyor ve idempotent.
 *
 * Yönlendirmeyi bu hook YAPMAZ, sadece `noticePending` ile bildirir. Sebebi
 * ekranda görüldü: `router.push('/trial-ended')` açılış navigasyonu/splash henüz
 * yerleşmemişken çağrıldığında sessizce düşüyor — ve ekran gösterildi işaretlendiği
 * için bir daha HİÇ açılmıyordu. Artık yönlendirmeyi splash bittikten sonra
 * `AppShell` yapıyor, "gösterildi" işaretini de ekranın kendisi mount olunca atıyor
 * (bkz. `app/trial-ended.tsx`); navigasyon düşerse bir sonraki açılışta tekrar denenir.
 */
export function useTrialLifecycle(): { noticePending: boolean } {
  const [noticePending, setNoticePending] = useState(false);
  const { settings, loaded: settingsLoaded, update } = useSettings();
  const { startedAt, active, endedNeedsNotice, acknowledgeEnded } = useTrial();
  const { entitled, entitlementKnown, isSubscribed } = useEntitlement();
  const endHandled = useRef(false);

  // Ön bilgilendirme uyarıları. Deneme aktifken ve okuma penceresi/dil değişince
  // yeniden kurulur (fonksiyon idempotent).
  useEffect(() => {
    if (!settingsLoaded || startedAt == null) return;
    if (!active || isSubscribed) {
      // Deneme bitti ya da kullanıcı abone oldu → uyarılar artık yanlış olurdu.
      void clearTrialNotices();
      return;
    }
    void scheduleTrialNotices(startedAt, settings);
  }, [
    settingsLoaded,
    startedAt,
    active,
    isSubscribed,
    settings.startHour,
    settings.startMinute,
    settings.endHour,
    settings.endMinute,
    settings.language,
    settings,
  ]);

  useEffect(() => {
    if (!endedNeedsNotice || endHandled.current) return;
    // Yetki bilinmiyorsa bekle: abone olmuş bir kullanıcıya "deneme bitti, Pro'ya
    // geç" ekranı göstermek en kötü hata olurdu.
    if (!entitlementKnown) return;

    endHandled.current = true;

    if (entitled) {
      // Deneme sırasında abone olmuş: bitiş bir olay değil. Ekranı hiç göstermeden
      // işaretle, yoksa abonelik ileride sona erdiğinde alakasız bir anda açılır.
      acknowledgeEnded();
      return;
    }

    void (async () => {
      const downgraded =
        settings.frequency > FREE_FREQUENCY_MAX
          ? { ...settings, frequency: FREE_FREQUENCY_MAX }
          : settings;
      if (downgraded !== settings) await update({ frequency: FREE_FREQUENCY_MAX });
      await applySchedule(downgraded);
      setNoticePending(true);
    })();
  }, [endedNeedsNotice, entitlementKnown, entitled, settings, update, acknowledgeEnded]);

  return { noticePending };
}
