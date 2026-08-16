import * as Notifications from 'expo-notifications';

import { getQuoteById, getQuotesByThemes } from '@/data/quotes';
import i18n from '@/i18n';
import { localizeAuthor, localizeOrigin } from '@/i18n/quoteLocalization';
import {
  NOTIFICATION_CHANNEL_ID,
  QUOTE_ACTION_FAVORITE,
  QUOTE_ACTION_ONE_MORE,
  RECKONING_KIND,
  pickQuoteId,
  quoteCategoryId,
  randomTitle,
  type ScheduledQuote,
} from '@/utils/scheduler';
import { DEFAULT_SETTINGS, type Settings } from '@/types/settings';
import { quoteDisplayText } from '@/utils/quoteText';
import { getJSON, setJSON, StorageKeys } from '@/utils/storage';
import { dateKey } from '@/utils/timeUtils';

/**
 * Günde en fazla kaç "bir tane daha" — feed kapısı açılmasın diye sert sınır
 * (W1.4 kararı: "Next butonu yok" ilkesi bu sınırla korunuyor).
 */
export const ONE_MORE_DAILY_LIMIT = 2;
/** "Bir tane daha" bildiriminin gelişine kadar bekleme (ms) — anlık hissettirir. */
const ONE_MORE_DELAY_MS = 5000;
/** `engagementLog`'un en fazla kaç kayıt taşıyacağı — sonsuza büyümesin. */
const ENGAGEMENT_LOG_CAP = 200;

/** Günlük "bir tane daha" sayacı. Bkz. `StorageKeys.extraQuoteLog`. */
export type ExtraQuoteLog = { date: string; count: number };
/** Bildirim gövdesine dokunma anı. Bkz. `StorageKeys.engagementLog`. */
export type EngagementEntry = { hour: number; at: number };

/**
 * `favorites` listesinin başına ekler; zaten varsa DOKUNMAZ (idempotent) — aynı
 * söz bildirimden iki kez ❤️'lense de liste sırası bozulmaz, tekrar eklenmez.
 */
export function addFavorite(favorites: number[], quoteId: number): number[] {
  if (favorites.includes(quoteId)) return favorites;
  return [quoteId, ...favorites];
}

/** Gün değiştiyse sayaç sıfır sayılır — log yalnızca BUGÜNÜN sayacını taşır. */
function todaysCount(log: ExtraQuoteLog | null, today: string): number {
  return log && log.date === today ? log.count : 0;
}

/**
 * `engagementLog`'a yeni kayıt ekler; cap aşılırsa EN ESKİSİ atılır (baştan
 * kesilir) — en yeni etkileşimler her zaman korunur.
 */
export function pushEngagement(
  log: EngagementEntry[],
  entry: EngagementEntry,
  cap: number = ENGAGEMENT_LOG_CAP
): EngagementEntry[] {
  const next = [...log, entry];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/**
 * ❤️ aksiyonu: `quoteId`'yi favorilerin başına ekler (zaten varsa no-op).
 * `useFavorites` mount'ta okuduğu için arka planda yazılan bu değişikliği
 * kaçırabilir — hook'a ayrıca `AppState → active` yeniden-okuma eklendi
 * (bkz. `useFavorites.ts`), yoksa açık duran uygulamada favori görünmez.
 */
export async function handleFavoriteAction(quoteId: number | undefined): Promise<void> {
  if (typeof quoteId !== 'number') return;
  const favorites = await getJSON<number[]>(StorageKeys.favorites, []);
  const next = addFavorite(favorites, quoteId);
  if (next !== favorites) await setJSON(StorageKeys.favorites, next);
}

/**
 * `handleOneMoreAction`'a AYNI süreç içinde eşzamanlı gelen çağrıları sıraya
 * sokar. Kod tabanı headless task + `getLastNotificationResponseAsync` yedek
 * yolunun AYNI cevabı iki kez işlemesini kasıtlı ve "zararsız" sayıyor
 * (`recordReckoningAction`daki gerekçe) — ama o varsayım idempotent bir
 * üzerine-yazmaya dayanıyor, `oneMore` ise sayaç ARTIRAN bir yan etki.
 * Kilit olmadan iki eşzamanlı çağrı aynı sayacı okuyup ikisi de bildirim
 * kurabiliyordu, günlük sınırı (`ONE_MORE_DAILY_LIMIT`) aşarak (code review,
 * 2026-08-16 — eşzamanlı çağrıyla doğrudan tekrarlandı).
 *
 * BU KİLİT TEK BAŞINA YETMEZ: headless görev tam kapalı bir uygulamada AYRI
 * bir JS sürecinde çalışır, kendi modül kapsamının kendi (taze) `oneMoreQueue`'su
 * vardır. Kullanıcı headless işlemden SONRA uygulamayı normal açarsa,
 * `getLastNotificationResponseAsync` aynı cevabı YENİ bir süreçte tekrar
 * döndürebilir — bu ikinci turda kilit hiçbir şeyi görmez, çünkü bambaşka bir
 * process'te taze başlıyor (ikinci code review turu, 2026-08-16: "mimari boşluk,
 * cihazda doğrulanmadı ama makul"). Bu yüzden asıl garanti kalıcı: bildirimin
 * kendi `identifier`'ı `processedOneMoreIds`'e yazılır, `alreadyProcessed` bunu
 * SÜREÇTEN BAĞIMSIZ kontrol eder — aynı cevap kaç kez/hangi süreçte tekrar
 * gelirse gelsin ikinci kez işlenmez.
 */
let oneMoreQueue: Promise<unknown> = Promise.resolve();

/** `processedOneMoreIds`'in en fazla kaç kayıt taşıyacağı. */
const PROCESSED_ONE_MORE_CAP = 50;

async function alreadyProcessedOneMore(notificationId: string | undefined): Promise<boolean> {
  if (!notificationId) return false; // kimlik yoksa (eski/test çağrısı) dedup uygulanamaz
  const ids = await getJSON<string[]>(StorageKeys.processedOneMoreIds, []);
  return ids.includes(notificationId);
}

async function markOneMoreProcessed(notificationId: string | undefined): Promise<void> {
  if (!notificationId) return;
  const ids = await getJSON<string[]>(StorageKeys.processedOneMoreIds, []);
  if (ids.includes(notificationId)) return;
  const next = [...ids, notificationId];
  await setJSON(
    StorageKeys.processedOneMoreIds,
    next.length > PROCESSED_ONE_MORE_CAP ? next.slice(next.length - PROCESSED_ONE_MORE_CAP) : next
  );
}

/**
 * "Bir tane daha" aksiyonu: günlük sınıra (`ONE_MORE_DAILY_LIMIT`) takılırsa
 * ya da bu TAM CEVAP (`notificationId`) daha önce işlendiyse SESSİZCE no-op —
 * yeni bildirim KURULMAZ ("hakkın bitti" bildirimi göndermek dırdıra döner,
 * W1.4 kararı). Sınır altındaysa havuzdan (W1.1 dışlama kurallı `pickQuoteId`)
 * bir söz seçip +5 sn'ye tek bildirim kurar; `scheduledQuoteIds`'e eklenir ki
 * `syncDeliveredToHistory` onu geçmişe taşısın. `triggeringQuoteId` (aksiyona
 * basılan bildirimin kendi sözü) dışlama setine eklenir — headless yolda bu
 * söz henüz `seenHistory`'ye girmemiş olabilir, o yüzden "bir tane daha" aynı
 * sözü tekrar seçebilirdi (code review bulgusu).
 */
export function handleOneMoreAction(
  now: Date = new Date(),
  triggeringQuoteId?: number,
  notificationId?: string
): Promise<void> {
  const task = oneMoreQueue.then(() => runOneMoreAction(now, triggeringQuoteId, notificationId));
  // Zincir bir sonraki çağrı için canlı kalsın diye hatayı burada yutuyoruz;
  // bu çağrının kendi reddi `task` üzerinden çağırana aynen ulaşır.
  oneMoreQueue = task.catch(() => undefined);
  return task;
}

async function runOneMoreAction(
  now: Date,
  triggeringQuoteId?: number,
  notificationId?: string
): Promise<void> {
  if (await alreadyProcessedOneMore(notificationId)) return;

  const today = dateKey(now);
  const log = await getJSON<ExtraQuoteLog | null>(StorageKeys.extraQuoteLog, null);
  const count = todaysCount(log, today);
  if (count >= ONE_MORE_DAILY_LIMIT) return;

  const storedSettings = await getJSON<Partial<Settings>>(StorageKeys.settings, {});
  const settings: Settings = { ...DEFAULT_SETTINGS, ...storedSettings };
  const pool = getQuotesByThemes(settings.themes);
  if (pool.length === 0) return;

  const history = await getJSON<number[]>(StorageKeys.seenHistory, []);
  const excludeSet = new Set(
    history.slice(0, Math.min(history.length, Math.floor(pool.length * 0.5)))
  );
  if (typeof triggeringQuoteId === 'number') excludeSet.add(triggeringQuoteId);
  const quoteId = pickQuoteId(pool, null, excludeSet);
  const quote = getQuoteById(quoteId);
  if (!quote) return;

  const fireDate = new Date(now.getTime() + ONE_MORE_DELAY_MS);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: randomTitle(settings.goal),
      body: quoteDisplayText(quote, i18n.locale),
      subtitle: `${localizeAuthor(quote.author, i18n.locale)} · ${localizeOrigin(quote.origin, i18n.locale)}`,
      data: { quoteId },
      categoryIdentifier: quoteCategoryId(), // "evet, onun da ❤️'si olur" — W1.4 kararı
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireDate,
      channelId: NOTIFICATION_CHANNEL_ID,
    },
  });

  await setJSON(StorageKeys.extraQuoteLog, { date: today, count: count + 1 });

  const scheduled = await getJSON<ScheduledQuote[]>(StorageKeys.scheduledQuoteIds, []);
  await setJSON(StorageKeys.scheduledQuoteIds, [
    ...scheduled,
    { id: quoteId, at: fireDate.getTime() },
  ]);

  // En son: her şey durdurulabilir bir hataya çarpmadan bitti, bu cevap artık
  // kalıcı olarak "işlendi" sayılabilir — hangi süreçte/kaç kez tekrar
  // gelirse gelsin bir daha bildirim kurmaz.
  await markOneMoreProcessed(notificationId);
}

/**
 * Söz bildirimi aksiyon cevabını işler — hem foreground listener
 * (`useNotificationObserver`) hem headless background task
 * (`notificationTaskHandler`) AYNI fonksiyonu çağırır (`recordReckoningAction`
 * deseniyle aynı). `data.kind === RECKONING_KIND` ise no-op: kategoriler
 * karışmasın, hesaplaşma cevapları yalnızca `recordReckoningAction`dan geçer.
 */
export async function recordQuoteAction(
  actionIdentifier: string,
  data: { quoteId?: number; kind?: string } | undefined,
  notificationId?: string
): Promise<void> {
  if (data?.kind === RECKONING_KIND) return;
  if (actionIdentifier === QUOTE_ACTION_FAVORITE) {
    await handleFavoriteAction(data?.quoteId);
    return;
  }
  if (actionIdentifier === QUOTE_ACTION_ONE_MORE) {
    await handleOneMoreAction(new Date(), data?.quoteId, notificationId);
    return;
  }
  // bilinmeyen aksiyon kimliği → no-op
}

/**
 * Bildirim gövdesine dokunma (DEFAULT aksiyon) anını kaydeder — W3.2'nin
 * "hangi saatte okunuyor" verisinin ham girdisi. Yalnızca söz bildirimlerinde
 * çağrılır (`useNotificationObserver`daki quoteId dalı); hesaplaşma/deneme
 * bildirimleri bu logu beslemez.
 */
export async function recordEngagement(now: Date = new Date()): Promise<void> {
  const log = await getJSON<EngagementEntry[]>(StorageKeys.engagementLog, []);
  const next = pushEngagement(log, { hour: now.getHours(), at: now.getTime() });
  await setJSON(StorageKeys.engagementLog, next);
}
