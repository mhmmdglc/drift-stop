import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getQuoteById, getQuotesByThemes } from '@/data/quotes';
import i18n from '@/i18n';
import { localizeAuthor, localizeOrigin } from '@/i18n/quoteLocalization';
import type { Quote } from '@/types/quote';
import { nativeFeaturesAvailable } from '@/utils/runtime';
import type { Settings } from '@/types/settings';
import { quoteDisplayText } from '@/utils/quoteText';
import { getJSON, setJSON, StorageKeys } from '@/utils/storage';
import {
  dateAt,
  dateKey,
  generateRandomTimes,
  isValidWindow,
  isWeekend,
  windowOf,
} from '@/utils/timeUtils';

export const NOTIFICATION_CHANNEL_ID = 'driftstop_motivation';
const DAYS_AHEAD = 3; // tampon: birkaç gün önceden zamanla
const MIN_GAP = 90; // dakika

/** Android bildirim kanalını oluştur (HIGH önem, titreşim, badge). */
export async function setupAndroidChannel(): Promise<void> {
  if (!nativeFeaturesAvailable || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: 'Motivation Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    // sound belirtilmedi → sistem varsayılan bildirim sesi (HIGH önemde ses çalar).
    // 'default' string'i özel dosya gibi aranıp uyarı veriyordu.
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    showBadge: true,
    lightColor: '#C8923A',
  });
}

/** Bildirim iznini kontrol et, gerekirse iste. true = izin var. */
export async function ensurePermissions(): Promise<boolean> {
  if (!nativeFeaturesAvailable) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

function randomTitle(): string {
  const titles = i18n.t('notifications.titles') as unknown as string[];
  if (Array.isArray(titles) && titles.length > 0) {
    return titles[Math.floor(Math.random() * titles.length)];
  }
  return i18n.t('app.name');
}

/** Havuzdan prevId dışında rastgele bir söz seç (art arda tekrar yok). */
function pickQuoteId(pool: Quote[], prevId: number | null): number {
  if (pool.length === 0) return -1;
  if (pool.length === 1) return pool[0].id;
  let i = Math.floor(Math.random() * pool.length);
  if (prevId !== null && pool[i].id === prevId) {
    i = (i + 1) % pool.length;
  }
  return pool[i].id;
}

export async function cancelAll(): Promise<void> {
  if (!nativeFeaturesAvailable) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Mevcut planı iptal eder ve ayarlara göre yeniden zamanlar.
 * Bildirimler kapalıysa sadece iptal eder.
 */
export async function applySchedule(settings: Settings): Promise<void> {
  if (!nativeFeaturesAvailable) return;
  await cancelAll();

  if (!settings.notificationsEnabled) {
    await setJSON(StorageKeys.scheduledQuoteIds, []);
    await setJSON(StorageKeys.lastScheduledDate, '');
    return;
  }

  const { startMin, endMin } = windowOf(settings);
  if (!isValidWindow(startMin, endMin)) return;

  const now = new Date();
  const pool = getQuotesByThemes(settings.themes);
  const scheduledIds: number[] = [];
  let prevId: number | null = null;

  for (let offset = 0; offset < DAYS_AHEAD; offset++) {
    const day = new Date(now);
    day.setDate(now.getDate() + offset);

    if (settings.disableWeekends && isWeekend(day)) continue;

    const times = generateRandomTimes(startMin, endMin, settings.frequency, MIN_GAP);
    for (const minuteOfDay of times) {
      const fireDate = dateAt(day, minuteOfDay);
      if (fireDate.getTime() <= now.getTime() + 60_000) continue; // geçmiş/çok yakın atla

      const quoteId = pickQuoteId(pool, prevId);
      prevId = quoteId;
      const quote = getQuoteById(quoteId);
      if (!quote) continue;

      const body = quoteDisplayText(quote, i18n.locale);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: randomTitle(),
          body,
          subtitle: `${localizeAuthor(quote.author, i18n.locale)} · ${localizeOrigin(quote.origin, i18n.locale)}`,
          data: { quoteId },
          // sound: kanal varsayılanı kullanılır (özel 'default' uyarısını önlemek için belirtilmedi)
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireDate,
          channelId: NOTIFICATION_CHANNEL_ID,
        },
      });
      scheduledIds.push(quoteId);
    }
  }

  await setJSON(StorageKeys.scheduledQuoteIds, scheduledIds);
  await setJSON(StorageKeys.lastScheduledDate, dateKey(now));
}

/** Bugün için plan yoksa (yeni gün / yeniden başlatma) yeniden zamanla. */
export async function rescheduleIfNeeded(settings: Settings): Promise<void> {
  if (!nativeFeaturesAvailable) return;
  if (!settings.notificationsEnabled) {
    await cancelAll();
    return;
  }
  const last = await getJSON<string>(StorageKeys.lastScheduledDate, '');
  const today = dateKey(new Date());
  if (last !== today) {
    await applySchedule(settings);
  }
}
