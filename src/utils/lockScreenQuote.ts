import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { getQuoteById } from '@/data/quotes';
import i18n from '@/i18n';
import { localizeAuthor } from '@/i18n/quoteLocalization';
import { quoteDisplayText } from '@/utils/quoteText';
import { nativeFeaturesAvailable } from '@/utils/runtime';

export const LOCK_SCREEN_CHANNEL_ID = 'lockscreen';
/** Sabit kimlik: her güncelleme öncekini değiştirir, bildirim yığmaz. */
export const LOCK_SCREEN_NOTIFICATION_ID = 'driftstop-lockscreen-quote';

/**
 * Sözü kilit ekranında, saatin hemen altında tutar.
 *
 * NEDEN BİLDİRİM: Kilit ekranı *widget'ları* yalnızca Android 16 QPR2 ve
 * sonrasında, üstelik üreticinin bu yüzeyi açtığı cihazlarda var. Bugünkü
 * kullanıcıların neredeyse hiçbirinde yok. Kalıcı sessiz bildirim ise
 * Android 5'ten beri her telefonda kilit ekranında görünüyor. İkisi birden
 * çalışıyor: widget'ı olan widget'ı görür, olmayan bildirimi.
 *
 * Kanal MIN önemde: ses yok, titreşim yok, açılır kart yok, durum çubuğunda
 * simge yok. Sadece kilit ekranında ve bildirim gölgesinde duruyor.
 */
export async function ensureLockScreenChannel(): Promise<void> {
  if (!nativeFeaturesAvailable || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(LOCK_SCREEN_CHANNEL_ID, {
    name: i18n.t('settings.lockScreen.channelName'),
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null, // sessiz: ses dosyası yok
    enableVibrate: false,
    vibrationPattern: null,
    showBadge: false,
    lightColor: '#C8923A',
  });
}

/** Kilit ekranındaki sözü verilen söze günceller. */
export async function showLockScreenQuote(quoteId: number): Promise<void> {
  if (!nativeFeaturesAvailable || Platform.OS !== 'android') return;
  const quote = getQuoteById(quoteId);
  if (!quote) return;

  const locale = i18n.locale ?? 'tr';
  let text: string;
  let author: string;
  try {
    text = quoteDisplayText(quote, locale);
    author = localizeAuthor(quote.author, locale);
  } catch {
    text = quote.text;
    author = quote.author;
  }

  try {
    await ensureLockScreenChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: LOCK_SCREEN_NOTIFICATION_ID,
      content: {
        // Söz başlıkta: kilit ekranında kalın ve en görünür satır orası.
        title: text,
        body: `— ${author}`,
        // Kaydırarak atılamasın; kilit ekranında kalıcı olsun.
        sticky: true,
        autoDismiss: false,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
        color: '#C8923A',
        data: { quoteId, lockScreen: true },
      },
      // ⚠️ trigger:null kanal BİLGİSİ TAŞIMAZ — bildirim expo'nun HIGH önemli
      // fallback kanalına düşüyor ve ses çıkarıyordu. ChannelAwareTriggerInput
      // hem "hemen göster" hem de kanal seçimi anlamına geliyor.
      trigger: { channelId: LOCK_SCREEN_CHANNEL_ID },
    });
  } catch {
    // izin yok / native modül yok — sessizce geç
  }
}

/** Kilit ekranındaki sözü kaldırır. */
export async function hideLockScreenQuote(): Promise<void> {
  if (!nativeFeaturesAvailable || Platform.OS !== 'android') return;
  try {
    await Notifications.dismissNotificationAsync(LOCK_SCREEN_NOTIFICATION_ID);
  } catch {
    // zaten yok
  }
  try {
    await Notifications.cancelScheduledNotificationAsync(LOCK_SCREEN_NOTIFICATION_ID);
  } catch {
    // zaten yok
  }
}

/** Ayara göre göster ya da kaldır. Tek giriş noktası. */
export async function syncLockScreenQuote(enabled: boolean, quoteId: number | null): Promise<void> {
  if (!enabled || quoteId == null) return hideLockScreenQuote();
  return showLockScreenQuote(quoteId);
}
