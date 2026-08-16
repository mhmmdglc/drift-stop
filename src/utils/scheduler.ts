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
/**
 * Deneme bildirimleri (6. ve 7. gün uyarıları) ayrı kanalda: kullanıcı günlük söz
 * bildirimlerini kapatsa bile denemenin bittiğini duymalı, ve tersi de geçerli —
 * bu iki uyarıyı susturmak günlük akışı susturmasın.
 */
export const TRIAL_CHANNEL_ID = 'driftstop_trial';
/**
 * Bildirim türü işareti (`content.data.kind`). `cancelAll()` bunu okuyup deneme
 * uyarılarını KORUR; yoksa her günlük yeniden planlama (`applySchedule` → `cancelAll`)
 * 6./7. gün uyarılarını sessizce siler ve kullanıcı denemenin bittiğini haber almaz.
 * İşaretsiz eski bildirimler günlük sayılır (geriye dönük uyumluluk).
 */
export const TRIAL_NOTICE_KIND = 'trial-notice';
/**
 * Gece hesaplaşması bildiriminin işareti (`data.kind`). `syncDeliveredToHistory`
 * yalnızca `data.quoteId` okuduğu için bu tür doğal olarak geçmişe sızmaz — söz
 * değildir, kotadan yemez (bkz. W1.3 kabul kriteri).
 */
export const RECKONING_KIND = 'reckoning';
/** Bildirim aksiyon kategorisi kimliği — `setupNotificationCategories` ile kaydedilir. */
export const RECKONING_CATEGORY = 'reckoning';
export const RECKONING_ACTION_RESISTED = 'resisted';
export const RECKONING_ACTION_DRIFTED = 'drifted';
/** Hesaplaşma bildirimi hiçbir zaman bu saatten geç kurulmaz (23:15). */
const RECKONING_LATEST_MIN = 23 * 60 + 15;
/** Hesaplaşma, pencerenin bitişinden bu kadar dakika sonra gelir. */
const RECKONING_OFFSET_MIN = 45;
const DAYS_AHEAD = 3; // tampon: birkaç gün önceden zamanla
const MIN_GAP = 90; // dakika
const HISTORY_CAP = 200; // useHistory ile aynı

/** Zamanlanmış bir bildirimin sözü + ne zaman gösterileceği (epoch ms). */
type ScheduledQuote = { id: number; at: number };

/** Android bildirim kanalını oluştur (HIGH önem, titreşim, badge). */
export async function setupAndroidChannel(): Promise<void> {
  if (!nativeFeaturesAvailable || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(TRIAL_CHANNEL_ID, {
    name: 'Trial Updates',
    importance: Notifications.AndroidImportance.DEFAULT,
    showBadge: true,
    lightColor: '#C8923A',
  });
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

/**
 * Hesaplaşma bildiriminin aksiyon butonlarını kaydeder (W0.a: `expo-task-manager`
 * ile headless işleme birincil yol, `getLastNotificationResponseAsync` yedek).
 * Buton metinleri diskten değil o an aktif `i18n.locale`den pişiyor — dil
 * değişince kategori de yeniden kaydedilmeli, bu yüzden `applySchedule` başında
 * da çağrılır (`_layout.tsx`'teki boot çağrısı yalnızca ilk kurulum içindir).
 * API cihaz/OS sürümüne göre desteklenmeyebilir → sessizce geç.
 */
export async function setupNotificationCategories(): Promise<void> {
  if (!nativeFeaturesAvailable) return;
  try {
    await Notifications.setNotificationCategoryAsync(RECKONING_CATEGORY, [
      {
        identifier: RECKONING_ACTION_RESISTED,
        buttonTitle: i18n.t('reckoning.actionResisted'),
        // İdeal senaryo (W0.a): headless background task işler, uygulama hiç
        // açılmaz — "tek dokunuşla günü kapat" vaadinin tam karşılığı.
        options: { opensAppToForeground: false },
      },
      {
        identifier: RECKONING_ACTION_DRIFTED,
        buttonTitle: i18n.t('reckoning.actionDrifted'),
        options: { opensAppToForeground: false },
      },
    ]);
  } catch {
    // kategori API'si yoksa (eski Expo Go/cihaz) sessizce geç
  }
}

/**
 * Kişisel başlık oranı — her bildirim kişiselleşirse tekrar hissi verir,
 * hiç kişiselleşmezse özellik görünmez.
 */
const GOAL_TITLE_RATIO = 0.3;

/** Test için export edildi; üretimde yalnızca applySchedule çağırır. */
export function randomTitle(goal: string | null): string {
  // W0.c tuzağı: %{goal} şablonu parametresiz çözülürse çıktı "[missing …]" olur
  // ve bildirimde aynen görünür — hedef yokken goalTitles havuzuna ASLA girilmez.
  if (goal) {
    const goalTitles = i18n.t('notifications.goalTitles') as unknown as string[];
    if (Array.isArray(goalTitles) && goalTitles.length > 0 && Math.random() < GOAL_TITLE_RATIO) {
      const idx = Math.floor(Math.random() * goalTitles.length);
      return i18n.t(`notifications.goalTitles.${idx}`, { goal });
    }
  }
  const titles = i18n.t('notifications.titles') as unknown as string[];
  if (Array.isArray(titles) && titles.length > 0) {
    return titles[Math.floor(Math.random() * titles.length)];
  }
  return i18n.t('app.name');
}

/**
 * Havuzdan rastgele bir söz seç. `excludeSet` yakın geçmişi ve aynı plandaki önceki
 * seçimleri taşır — günde 5 bildirimle "hep aynı sözler" hissi uygulamayı sildirir.
 * Hepsi dışlanmışsa dışlama yok sayılır: dar havuzda plansız kalmak tekrardan kötü.
 */
function pickQuoteId(pool: Quote[], prevId: number | null, excludeSet: Set<number>): number {
  if (pool.length === 0) return -1;
  if (pool.length === 1) return pool[0].id;
  // ≤2 sözlük havuzda dışlama anlamsız — art arda tekrar engeli tek başına yeterli.
  const candidates = pool.length > 2 ? pool.filter((q) => !excludeSet.has(q.id)) : pool;
  const source = candidates.length > 0 ? candidates : pool;
  let i = Math.floor(Math.random() * source.length);
  if (prevId !== null && source[i].id === prevId && source.length > 1) {
    i = (i + 1) % source.length;
  }
  return source[i].id;
}

/**
 * Günlük söz bildirimlerini iptal eder — deneme uyarılarına DOKUNMAZ.
 *
 * `cancelAllScheduledNotificationsAsync()` kullanan sürüm, her yeni günde
 * (`rescheduleIfNeeded` → `applySchedule` → burası) 6./7. gün deneme uyarılarını da
 * siliyordu; uyarılar deneme başında bir kez kurulduğu için bir daha geri gelmiyor
 * ve kullanıcı "sürpriz olmasın" sözüne rağmen habersiz kalıyordu.
 */
export async function cancelAll(): Promise<void> {
  if (!nativeFeaturesAvailable) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const daily = scheduled.filter(
      (n) => (n.content.data as { kind?: string } | undefined)?.kind !== TRIAL_NOTICE_KIND
    );
    // Hepsi günlükse tek çağrı daha ucuz (tipik durum: deneme yok/bitti).
    if (daily.length === scheduled.length) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return;
    }
    await Promise.all(daily.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  } catch {
    // Listeyi okuyamadıysak yine de günlük planı temizlemek gerekiyor: alternatif
    // "hiçbir şey iptal etmemek" ve bildirimlerin katlanarak birikmesi olurdu.
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}

/**
 * Mevcut planı iptal eder ve ayarlara göre yeniden zamanlar.
 * Bildirimler kapalıysa sadece iptal eder.
 */
export async function applySchedule(settings: Settings): Promise<void> {
  if (!nativeFeaturesAvailable) return;
  // Buton metinleri aktif dilden pişiyor — dil değişip de kategori yeniden
  // kaydedilmezse kullanıcı eski dildeki butonları görmeye devam eder.
  await setupNotificationCategories();
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
  // Dışlama, geçmişin en yeni kayıtlarından kurulur ama havuzun yarısını aşamaz:
  // tema filtresi havuzu daralttığında bile seçilecek söz her zaman kalır.
  const history = await getJSON<number[]>(StorageKeys.seenHistory, []);
  const excludeSet = new Set(
    history.slice(0, Math.min(history.length, Math.floor(pool.length * 0.5)))
  );
  const scheduled: ScheduledQuote[] = [];
  let prevId: number | null = null;

  for (let offset = 0; offset < DAYS_AHEAD; offset++) {
    const day = new Date(now);
    day.setDate(now.getDate() + offset);

    if (settings.disableWeekends && isWeekend(day)) continue;

    const times = generateRandomTimes(startMin, endMin, settings.frequency, MIN_GAP);
    for (const minuteOfDay of times) {
      const fireDate = dateAt(day, minuteOfDay);
      if (fireDate.getTime() <= now.getTime() + 60_000) continue; // geçmiş/çok yakın atla

      const quoteId = pickQuoteId(pool, prevId, excludeSet);
      prevId = quoteId;
      // Seçilen de dışlanır → 3 günlük plan kendi içinde de tekrarsız (havuz elverdiğince).
      excludeSet.add(quoteId);
      const quote = getQuoteById(quoteId);
      if (!quote) continue;

      const body = quoteDisplayText(quote, i18n.locale);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: randomTitle(settings.goal),
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
      scheduled.push({ id: quoteId, at: fireDate.getTime() });
    }

    // Gece hesaplaşması: söz DEĞİLDİR, `scheduled` planına eklenmez (syncDeliveredToHistory
    // yalnızca data.quoteId okur, bu tür doğal olarak dışarıda kalır). Pencere bitişinden
    // 45 dk sonra, 23:15 üst sınırıyla — hafta sonu kuralı yukarıdaki `continue` ile zaten
    // uygulanmış oluyor (o gün için hiçbir bildirim kurulmuyor).
    if (settings.reckoningEnabled) {
      const reckoningMinute = Math.min(endMin + RECKONING_OFFSET_MIN, RECKONING_LATEST_MIN);
      const reckoningFireDate = dateAt(day, reckoningMinute);
      if (reckoningFireDate.getTime() > now.getTime() + 60_000) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: i18n.t('reckoning.notifTitle'),
            body: i18n.t('reckoning.notifBody'),
            data: { kind: RECKONING_KIND, date: dateKey(day) },
            categoryIdentifier: RECKONING_CATEGORY,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reckoningFireDate,
            channelId: NOTIFICATION_CHANNEL_ID,
          },
        });
      }
    }
  }

  await setJSON(StorageKeys.scheduledQuoteIds, scheduled);
  await setJSON(StorageKeys.lastScheduledDate, dateKey(now));
}

/**
 * Teslim edilmiş (fire zamanı geçmiş veya çekmecede duran) bildirimlerin sözlerini
 * geçmişe (seenHistory) taşır. Uygulama açıldığında/öne geldiğinde çağrılır — böylece
 * kullanıcı gün içinde bildirimle gelen TÜM sözleri app içinde görebilir.
 * Değişiklik olduysa güncellenmiş geçmiş dizisini, yoksa null döndürür.
 */
export async function syncDeliveredToHistory(): Promise<number[] | null> {
  if (!nativeFeaturesAvailable) return null;

  const deliveredIds: number[] = [];

  // 1) Şu an bildirim çekmecesinde duran bildirimler (kesin teslim edilmiş).
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const n of presented) {
      const qid = (n.request.content.data as { quoteId?: number } | undefined)?.quoteId;
      if (typeof qid === 'number') deliveredIds.push(qid);
    }
  } catch {
    // çekmece okunamadıysa yoksay
  }

  // 2) Zamanlanan listede fire zamanı geçmiş olanlar (çekmeceden silinmiş olsalar bile).
  const scheduled = await getJSON<ScheduledQuote[] | number[]>(StorageKeys.scheduledQuoteIds, []);
  if (Array.isArray(scheduled) && scheduled.length > 0 && typeof scheduled[0] === 'object') {
    const list = scheduled as ScheduledQuote[];
    const now = Date.now();
    const remaining: ScheduledQuote[] = [];
    for (const s of list.slice().sort((a, b) => a.at - b.at)) {
      if (s && s.at <= now) deliveredIds.push(s.id);
      else if (s) remaining.push(s);
    }
    if (remaining.length !== list.length) {
      await setJSON(StorageKeys.scheduledQuoteIds, remaining);
    }
  }

  if (deliveredIds.length === 0) return null;

  const history = await getJSON<number[]>(StorageKeys.seenHistory, []);
  let next = history;
  for (const id of deliveredIds) {
    next = [id, ...next.filter((x) => x !== id)]; // en son eklenen index 0'da (en yeni)
  }
  next = next.slice(0, HISTORY_CAP);
  await setJSON(StorageKeys.seenHistory, next);
  return next;
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
  // Eski format (number[]) tespit edilirse de yeniden zamanla → ileriki bildirimler
  // fire zamanı bilgisiyle saklanır ve geçmişe taşıma çalışır.
  const scheduled = await getJSON<unknown[]>(StorageKeys.scheduledQuoteIds, []);
  const oldFormat =
    Array.isArray(scheduled) && scheduled.length > 0 && typeof scheduled[0] === 'number';
  if (last !== today || oldFormat) {
    await applySchedule(settings);
  }
}
