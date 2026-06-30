import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { getQuoteById } from '@/data/quotes';
import { nativeFeaturesAvailable } from '@/utils/runtime';
import { setJSON, StorageKeys } from '@/utils/storage';
import { DriftStopWidget } from './DriftStopWidget';

/**
 * Uygulama içinden widget'ı belirli bir sözle günceller (ör. kullanıcı yeni söze geçince).
 * Expo Go / Android dışı / widget eklenmemişse sessizce geçer.
 */
export async function updateWidgetWithQuote(quoteId: number): Promise<void> {
  if (!nativeFeaturesAvailable || Platform.OS !== 'android') return;
  await setJSON(StorageKeys.widgetQuoteId, quoteId);
  try {
    await requestWidgetUpdate({
      widgetName: 'DriftStop',
      renderWidget: () => <DriftStopWidget quote={getQuoteById(quoteId) ?? null} />,
      widgetNotFound: () => {},
    });
  } catch {
    // native modül yok (Expo Go) ya da widget yok — sessizce geç
  }
}
