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
import { eligibleMessages, markDelivered, type VaultMessage } from '@/utils/vault';
import { hourWeights, pruneEngagementLog } from '@/utils/engagement';
// `EngagementEntry` yalnızca tip olarak lazım — `quoteAction.ts` da bu dosyadan
// (`pickQuoteId`, `quoteCategoryId`...) değer import ediyor; `import type` derleme
// zamanında silindiği için döngüsel require oluşmuyor.
import type { EngagementEntry } from '@/utils/quoteAction';
import {
  dateAt,
  dateKey,
  generateRandomTimes,
  generateWeightedTimes,
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
export const RECKONING_ACTION_RESISTED = 'resisted';
export const RECKONING_ACTION_DRIFTED = 'drifted';
/**
 * Kasa mesajı bildiriminin işareti (`data.kind`). Söz DEĞİLDİR — bir günün söz
 * saatlerinden birinin YERİNE geçer (W2.1 kararı, `VAULT_DAILY_CHANCE`). Kategori
 * bilinçli olarak atanmaz (❤️/"bir tane daha" bir kullanıcı cümlesinde anlamsız).
 */
export const VAULT_KIND = 'vault';
/** Kasa mesajının günlük teslim olasılığı — W2.1 kararı, "ortalama 4 günde bir". */
export const VAULT_DAILY_CHANCE = 0.25;
export const QUOTE_ACTION_FAVORITE = 'favorite';
export const QUOTE_ACTION_ONE_MORE = 'oneMore';
/**
 * Kategori kimlikleri BİLE İSMİNE `i18n.locale`i taşır (`reckoning_tr`,
 * `quote_en`, ...) — SABİT string DEĞİL, her çağrıda TAZE hesaplanan bir
 * fonksiyon. Neden: Android, `setNotificationCategoryAsync`'e AYNI kimlikle
 * ikinci kez verilen buton metinlerini GÜNCELLEMİYOR (kanalın sesi gibi,
 * kategorinin de buton metinleri ilk kayıttan sonra donuyor — cihaz QA'sında
 * bulundu, 2026-08-16: `_layout.tsx`'teki ilk kayıt `SettingsProvider`'ın
 * gerçek dili yüklemesinden ÖNCE, `i18n.locale`in modül-yüklemede sabitlenen
 * 'tr' varsayılanıyla koşuyordu — ve dil sonradan doğru ayarlanıp
 * `applySchedule` yeniden kaydetse bile Android o ilk 'tr' buton metinlerini
 * kalıcı olarak koruyordu). Kimliği dile göre değiştirmek, "güncelleme" değil
 * "yeni kategori" olarak kaydettirdiği için bu donmayı bypass ediyor — en
 * fazla 8 dil × 2 kategori = 16 kalıcı Android kaydı, ihmal edilebilir.
 */
export function reckoningCategoryId(): string {
  return `reckoning_${i18n.locale}`;
}
/**
 * Günlük söz bildirimlerinin aksiyon kategorisi (W1.4: ❤️ favorile / "bir tane
 * daha"). Hesaplaşma ve deneme bildirimlerinde bu kategori KULLANILMAZ — aksiyonlar
 * yalnızca söz bildirimlerinde anlamlı (bkz. `recordQuoteAction` guard'ı).
 */
export function quoteCategoryId(): string {
  return `quote_${i18n.locale}`;
}
/**
 * Hesaplaşma bildirimi için gün-içi son temsil edilebilir dakika (23:59) — yalnızca
 * `dateAt` aynı gün içinde kalsın diye bir tavan, pencere bitişinin ÖNÜNE geçmez (aşağıya bkz.).
 */
const RECKONING_DAY_CAP_MIN = 23 * 60 + 59;
/** Hesaplaşma, pencerenin bitişinden bu kadar dakika sonra gelir. */
const RECKONING_OFFSET_MIN = 45;
const DAYS_AHEAD = 3; // tampon: birkaç gün önceden zamanla
const MIN_GAP = 90; // dakika
const HISTORY_CAP = 200; // useHistory ile aynı

/**
 * Zamanlanmış bir bildirimin sözü + ne zaman gösterileceği (epoch ms). Export
 * edildi: `quoteAction.ts`'teki "bir tane daha" aksiyonu aynı şekilde
 * `scheduledQuoteIds`'e ekleme yapar (`syncDeliveredToHistory` bunu okur).
 */
export type ScheduledQuote = { id: number; at: number };

/**
 * Henüz fire etmemiş kasa bildirimi kaydı — `ScheduledQuote`den BİLİNÇLİ olarak
 * ayrı bir dizi (`StorageKeys.scheduledVaultMessages`): aynı diziye karışırsa
 * `syncDeliveredToHistory` `quoteId` bekleyen okumasıyla onu geçmişe taşımaya
 * çalışabilirdi. Teslim tespiti `syncDeliveredVaultMessages` bu tipi okur.
 */
export type ScheduledVaultMessage = { vaultId: number; at: number };

/**
 * Kasa bildiriminin gövdesindeki imza satırı için okunur tarih ("3 Mayıs" gibi).
 * Hermes'in bazı sürümlerinde tam ICU verisi olmayabilir (`reckoning.tsx`daki
 * aynı gerekçe) — desteklenmeyen bir locale/motor `dateKey` biçimine düşer.
 */
function vaultDateLabel(day: Date): string {
  try {
    return new Intl.DateTimeFormat(i18n.locale, { day: 'numeric', month: 'long' }).format(day);
  } catch {
    return dateKey(day);
  }
}

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
 * Bildirim aksiyon butonlarını kaydeder (W0.a: `expo-task-manager` ile headless
 * işleme birincil yol, `getLastNotificationResponseAsync` yedek). Hesaplaşma VE
 * söz kategorileri AYNI çağrıda pişiyor — ikisinin de buton metinleri o an aktif
 * `i18n.locale`den geliyor. Kimlikler `reckoningCategoryId()`/`quoteCategoryId()`
 * ile dil-özelinde olduğu için dil değişince "güncelleme" değil "yeni kayıt"
 * olur (yukarıdaki fonksiyon yorumuna bkz. — Android eski kimlikli bir kategorinin
 * buton metnini asla güncellemiyor). `applySchedule` başında da çağrılır
 * (`_layout.tsx`'teki boot çağrısı yalnızca `settingsLoaded` sonrası, ilk kurulum
 * içindir). API cihaz/OS sürümüne göre desteklenmeyebilir → sessizce geç.
 */
export async function setupNotificationCategories(): Promise<void> {
  if (!nativeFeaturesAvailable) return;
  try {
    await Notifications.setNotificationCategoryAsync(reckoningCategoryId(), [
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
    await Notifications.setNotificationCategoryAsync(quoteCategoryId(), [
      {
        identifier: QUOTE_ACTION_FAVORITE,
        buttonTitle: i18n.t('notifications.actionFavorite'),
        // Aynı gerekçe: sözü açmadan favoriler — "sürtünmesiz etkileşim" (W1.4).
        options: { opensAppToForeground: false },
      },
      {
        identifier: QUOTE_ACTION_ONE_MORE,
        buttonTitle: i18n.t('notifications.actionOneMore'),
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
 * Export edildi: `quoteAction.ts`'teki "bir tane daha" aksiyonu aynı kuralla seçim yapar.
 */
export function pickQuoteId(pool: Quote[], prevId: number | null, excludeSet: Set<number>): number {
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
  // Plan HER ZAMAN tamamen yeniden yazılır (aşağıda `scheduledVaultMessages`
  // de dahil) — bu senkron BUNUN ÖNÜNDE çalışmalı, yoksa fire zamanı geçmiş
  // ama henüz `markDelivered` çağrılmamış bir kasa kaydı, hiç teslim
  // işaretlenmeden listeden düşer ve o mesaj SONSUZA KADAR "teslim edilmemiş"
  // kalıp tekrar tekrar planlanabilirdi ("teslim edilen emekli olur" kararının
  // ihlali — code review, 2026-08-16).
  await syncDeliveredVaultMessages();
  // Buton metinleri aktif dilden pişiyor — dil değişip de kategori yeniden
  // kaydedilmezse kullanıcı eski dildeki butonları görmeye devam eder.
  await setupNotificationCategories();
  await cancelAll();

  if (!settings.notificationsEnabled) {
    await setJSON(StorageKeys.scheduledQuoteIds, []);
    // Kasa planı da eski OS kayıtlarıyla birlikte iptal edildi (yukarıdaki `cancelAll`) —
    // burada temizlenmezse `syncDeliveredVaultMessages` hiç fire etmemiş kayıtları
    // "teslim edildi" sanıp mesajı erken emekli edebilir.
    await setJSON(StorageKeys.scheduledVaultMessages, []);
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

  // Kasa: uygun mesajlar bir kez okunur, plan boyunca tüketilir (`usedVaultIds`) — aynı
  // mesaj bu 3 günlük planda İKİNCİ kez seçilmez (W2.1 kararı).
  const vaultCandidates = await eligibleMessages(now.getTime());
  const usedVaultIds = new Set<number>();
  const scheduledVault: ScheduledVaultMessage[] = [];

  // Akıllı zamanlama (W3.2): ağırlıklar `applySchedule` başına BİR KEZ hesaplanır,
  // 3 günün hepsine aynen uygulanır — log/histogram bu üç gün boyunca değişmez,
  // günde bir okuma da gereksiz iş yaratmaz. `smartTiming` kapalıysa log'a hiç
  // dokunulmaz (mevcut davranışla bit-bit aynı kalsın diye).
  let weights: Record<number, number> | null = null;
  if (settings.smartTiming) {
    const rawLog = await getJSON<EngagementEntry[]>(StorageKeys.engagementLog, []);
    // 90 günden eski kayıtlar burada budanır (spec kararı) — log zaten push
    // sırasında 200 kayıtla sınırlı, ama bu tazelik için: kullanıcının okuma
    // saatleri zamanla kayarsa histogram eski alışkanlığı süresiz taşımasın.
    const prunedLog = pruneEngagementLog(rawLog, now.getTime());
    if (prunedLog.length !== rawLog.length) {
      await setJSON(StorageKeys.engagementLog, prunedLog);
    }
    weights = hourWeights(prunedLog);
  }

  for (let offset = 0; offset < DAYS_AHEAD; offset++) {
    const day = new Date(now);
    day.setDate(now.getDate() + offset);

    if (settings.disableWeekends && isWeekend(day)) continue;

    // `weights` `null` ise (özellik kapalı ya da veri < 20) `generateWeightedTimes`
    // zaten `generateRandomTimes`'a düşer — ama koşulu burada açıkça yazmak, "hangi
    // üreteç ne zaman koşuyor" sorusunu okuyanlar için tek satırda cevaplıyor.
    const times = weights
      ? generateWeightedTimes(startMin, endMin, settings.frequency, MIN_GAP, weights)
      : generateRandomTimes(startMin, endMin, settings.frequency, MIN_GAP);

    // Zar + uygunluk, saatler üretildikten ama hiçbir bildirim kurulmadan ÖNCE atılır:
    // günde en fazla 1 kasa mesajı, söz saatlerinden birinin YERİNE geçer (toplam
    // bildirim sayısı sabit kalır — "net bildirim artışı sıfır" kararı). Slot yalnızca
    // GERÇEKTEN kurulabilecek (henüz geçmemiş) saatlerden seçilir — aksi halde rastgele
    // seçim geçmiş bir saate denk gelirse (örn. gün ortasında yeniden planlama) mesaj hiç
    // kurulmadan kaybolur; `usedVaultIds`e ekleme de yalnızca bildirim GERÇEKTEN
    // kurulduğunda yapılır (aşağıda) — aksi halde tek uygun mesaj varken tüm 3 günlük
    // plan sıfır kasa bildirimiyle bitebilirdi (code review bulgusu, 2026-08-16).
    let vaultSlotIndex = -1;
    let vaultSlotMessage: VaultMessage | null = null;
    if (times.length > 0 && Math.random() < VAULT_DAILY_CHANCE) {
      const candidate = vaultCandidates.find((m) => !usedVaultIds.has(m.id));
      if (candidate) {
        const futureIndices: number[] = [];
        for (let i = 0; i < times.length; i++) {
          if (dateAt(day, times[i]).getTime() > now.getTime() + 60_000) futureIndices.push(i);
        }
        if (futureIndices.length > 0) {
          vaultSlotIndex = futureIndices[Math.floor(Math.random() * futureIndices.length)];
          vaultSlotMessage = candidate;
        }
      }
    }

    for (let i = 0; i < times.length; i++) {
      const minuteOfDay = times[i];
      const fireDate = dateAt(day, minuteOfDay);
      if (fireDate.getTime() <= now.getTime() + 60_000) continue; // geçmiş/çok yakın atla

      if (i === vaultSlotIndex && vaultSlotMessage) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: randomTitle(settings.goal), // normal havuzdan — sürpriz bozulmasın
            body: vaultSlotMessage.text,
            subtitle: i18n.t('vault.signature', { date: vaultDateLabel(day) }),
            data: { kind: VAULT_KIND, vaultId: vaultSlotMessage.id },
            // categoryIdentifier YOK: ❤️ / "bir tane daha" bir kullanıcı cümlesinde anlamsız.
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fireDate,
            channelId: NOTIFICATION_CHANNEL_ID,
          },
        });
        // `scheduled` (söz planı) DEĞİL, ayrı diziye — bkz. `ScheduledVaultMessage` yorumu.
        scheduledVault.push({ vaultId: vaultSlotMessage.id, at: fireDate.getTime() });
        // Yalnızca bildirim GERÇEKTEN kurulduktan sonra "kullanıldı" sayılır.
        usedVaultIds.add(vaultSlotMessage.id);
        continue;
      }

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
          categoryIdentifier: quoteCategoryId(), // ❤️ / "bir tane daha" aksiyonları (W1.4)
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
    // 45 dk sonra — ama pencere zaten 23:14'ten geç bitiyorsa (kullanıcı 23:30'a kadar
    // seçebiliyor) +45 dk gün taşırdığı için 23:59'a kırpılır. Kırpma ASLA endMin'in
    // altına düşmez (`Math.max(endMin, ...)`) — aksi halde hesaplaşma, kapanmamış bir
    // pencerenin ortasında, kendi sözlerinden ÖNCE gelirdi (bulundu: code review, 2026-08-16).
    // Hafta sonu kuralı yukarıdaki `continue` ile zaten uygulanmış oluyor.
    if (settings.reckoningEnabled) {
      const reckoningMinute = Math.max(
        endMin,
        Math.min(endMin + RECKONING_OFFSET_MIN, RECKONING_DAY_CAP_MIN)
      );
      const reckoningFireDate = dateAt(day, reckoningMinute);
      if (reckoningFireDate.getTime() > now.getTime() + 60_000) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: i18n.t('reckoning.notifTitle'),
            body: i18n.t('reckoning.notifBody'),
            data: { kind: RECKONING_KIND, date: dateKey(day) },
            categoryIdentifier: reckoningCategoryId(),
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
  await setJSON(StorageKeys.scheduledVaultMessages, scheduledVault);
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

/**
 * Fire zamanı geçmiş kasa bildirimlerini `utils/vault.ts#markDelivered` ile teslim
 * edildi olarak işaretler ve bekleyen listeden düşürür — `syncDeliveredToHistory`nin
 * kasa karşılığı, ama AYRI: kasa mesajları `seenHistory`ye asla girmez (söz değildir).
 * Çağıran taraf (UI/route katmanı) bu iş kapsamının dışında; yalnızca export edilir.
 */
export async function syncDeliveredVaultMessages(): Promise<void> {
  const scheduled = await getJSON<ScheduledVaultMessage[]>(StorageKeys.scheduledVaultMessages, []);
  if (scheduled.length === 0) return;

  const now = Date.now();
  const remaining: ScheduledVaultMessage[] = [];
  for (const s of scheduled) {
    if (s && s.at <= now) {
      await markDelivered(s.vaultId, s.at);
    } else if (s) {
      remaining.push(s);
    }
  }
  if (remaining.length !== scheduled.length) {
    await setJSON(StorageKeys.scheduledVaultMessages, remaining);
  }
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
