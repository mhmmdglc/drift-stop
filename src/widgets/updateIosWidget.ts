import { Platform } from 'react-native';

import { getQuoteById } from '@/data/quotes';
import i18n from '@/i18n';
import { localizeAuthor } from '@/i18n/quoteLocalization';
import { quoteDisplayText } from '@/utils/quoteText';
import { nativeFeaturesAvailable } from '@/utils/runtime';

/** app.json'daki ios.entitlements ile birebir aynı olmalı; eklenti de bunu okuyor. */
export const APP_GROUP = 'group.com.driftstop.app';
export const LAST_QUOTE_KEY = 'lastQuote';

/**
 * Kilit ekranı için sözü iOS widget eklentisine geçirir.
 *
 * Android'deki kalıcı bildirim numarası iOS'ta yok — iOS'ta silinemez bildirim
 * diye bir şey yok. Kilit ekranında kalıcı olarak duran tek şey WidgetKit'in
 * `accessoryRectangular` widget'ı, o da veriyi ancak App Group üzerinden görüyor.
 *
 * Widget başka bir süreçte çalıştığı için JS state'i okuyamaz; sözü buradan
 * paylaşılan UserDefaults'a yazıp zaman çizelgesini yeniliyoruz.
 */
export async function updateIosWidgetWithQuote(quoteId: number): Promise<void> {
  if (!nativeFeaturesAvailable || Platform.OS !== 'ios') return;
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
    // Expo Go'da native modül yok; import'u da tembel tutuyoruz ki orada patlamasın.
    const { ExtensionStorage } = require('@bacons/apple-targets');
    const storage = new ExtensionStorage(APP_GROUP);
    storage.set(LAST_QUOTE_KEY, JSON.stringify({ id: quote.id, text, author }));
    ExtensionStorage.reloadWidget();
  } catch {
    // eklenti/App Group yok ya da Expo Go — sessizce geç
  }
}
