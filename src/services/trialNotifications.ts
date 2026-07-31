import * as Notifications from 'expo-notifications';

import i18n from '@/i18n';
import { TRIAL_DAYS } from '@/services/trial';
import type { Settings } from '@/types/settings';
import { nativeFeaturesAvailable } from '@/utils/runtime';
import { TRIAL_CHANNEL_ID, TRIAL_NOTICE_KIND } from '@/utils/scheduler';
import { windowOf } from '@/utils/timeUtils';

/**
 * Denemenin bitişini önceden haber veren iki bildirim (spec §5.4).
 *
 * Neden ayrı modül ve ayrı kanal: bunlar günlük söz akışının parçası DEĞİL. Günlük
 * kotayı (3/5/7/10) yememeleri gerekiyor, `applySchedule` tarafından silinmemeleri
 * gerekiyor (bkz. `cancelAll` içindeki `TRIAL_NOTICE_KIND` koruması) ve kullanıcı
 * günlük bildirimleri kapatsa bile bu ikisi gitmeli — "sürpriz olmasın" kararı.
 *
 * Gün eşlemesi (`dayIndex` 0 = kurulum günü):
 *   dayIndex 5 → takvimde 6. gün  → "yarından sonra ritim değişiyor"
 *   dayIndex 6 → takvimde 7. gün  → "bugün son gün" (son aktif gün)
 *   dayIndex 7 → takvimde 8. gün  → deneme bitti, tam ekran
 */

/** İkisi de kullanıcının okuma penceresinin SONUNDA çalar (varsayılan 21:00 → akşam). */
const NOTICE_DAY_INDEXES = [TRIAL_DAYS - 2, TRIAL_DAYS - 1] as const;

function noticeFireDate(startedAt: number, dayIndex: number, endMinuteOfDay: number): Date {
  const start = new Date(startedAt);
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + dayIndex);
  d.setHours(Math.floor(endMinuteOfDay / 60), endMinuteOfDay % 60, 0, 0);
  return d;
}

async function cancelTrialNotices(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => (n.content.data as { kind?: string } | undefined)?.kind === TRIAL_NOTICE_KIND)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

/**
 * Uyarıları (yeniden) kurar. Idempotent: önce eskilerini iptal eder, yani her
 * açılışta çağrılabilir — bu şart, çünkü kullanıcı okuma penceresini değiştirirse
 * uyarı saatinin de kayması gerekir ve dil değişirse metnin yeniden üretilmesi gerekir.
 *
 * Hata yutulur: bu, açılış yolunda çalışan yan bir iş; bildirim zamanlaması
 * patlarsa uygulama açılmaya devam etmeli.
 */
export async function scheduleTrialNotices(startedAt: number, settings: Settings): Promise<void> {
  if (!nativeFeaturesAvailable) return;
  try {
    await cancelTrialNotices();

    const { endMin } = windowOf(settings);
    const now = Date.now();

    for (const dayIndex of NOTICE_DAY_INDEXES) {
      const fire = noticeFireDate(startedAt, dayIndex, endMin);
      // Geçmişte kalan uyarı kurulmaz: kullanıcı denemenin 6. gününde uygulamayı ilk
      // kez açtıysa 6. gün uyarısı zaten kaçmıştır, 7. gün olanı yine kurulur.
      if (fire.getTime() <= now + 60_000) continue;

      const key = dayIndex === TRIAL_DAYS - 2 ? 'day6' : 'day7';
      await Notifications.scheduleNotificationAsync({
        content: {
          title: i18n.t(`trial.notice.${key}.title`),
          body: i18n.t(`trial.notice.${key}.body`),
          data: { kind: TRIAL_NOTICE_KIND, dayIndex },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fire,
          channelId: TRIAL_CHANNEL_ID,
        },
      });
    }
  } catch {
    // sessizce geç — açılışı bloke etmez
  }
}

/** Deneme bitince/aboneliğe geçilince artık gereksiz uyarıları temizler. */
export async function clearTrialNotices(): Promise<void> {
  if (!nativeFeaturesAvailable) return;
  try {
    await cancelTrialNotices();
  } catch {
    // sessizce geç
  }
}
