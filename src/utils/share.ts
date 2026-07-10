import { Share } from 'react-native';

import i18n from '@/i18n';
import { localizeAuthor } from '@/i18n/quoteLocalization';
import { quoteDisplayText } from '@/utils/quoteText';
import type { Quote } from '@/types/quote';

/**
 * Sözü metin olarak paylaşır.
 * Not: spec "expo-sharing" diyor ama o paket DOSYA paylaşımı içindir; düz metin için
 * React Native'in yerleşik Share API'si doğru araçtır. (Görsel paylaşımı eklenirse expo-sharing kullanılır.)
 */
export async function shareQuote(quote: Quote): Promise<void> {
  const locale = i18n.locale;
  const text = quoteDisplayText(quote, locale);
  const message = i18n.t('share.quoteTemplate', {
    quote: text,
    author: localizeAuthor(quote.author, locale),
  });

  try {
    await Share.share({ message });
  } catch {
    // kullanıcı iptal etti veya paylaşım başarısız — sessizce geç
  }
}
