import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { getQuoteById, QUOTES } from '@/data/quotes';
import { getJSON, setJSON, StorageKeys } from '@/utils/storage';
import { DriftStopWidget } from './DriftStopWidget';

/**
 * Widget yaşam döngüsü işleyicisi (headless çalışabilir).
 * - WIDGET_ADDED: kaydedilmiş söz yoksa rastgele seç.
 * - WIDGET_UPDATE: her periyodik güncellemede taze rastgele söz (rotasyon).
 * Tıklama OPEN_URI ile arka planda ele alınır (burada WIDGET_CLICK gelmez).
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      let id = await getJSON<number>(StorageKeys.widgetQuoteId, 0);
      if (props.widgetAction === 'WIDGET_UPDATE' || !id) {
        const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
        id = q.id;
        await setJSON(StorageKeys.widgetQuoteId, id);
      }
      const quote = getQuoteById(id) ?? null;
      props.renderWidget(<DriftStopWidget quote={quote} />);
      break;
    }
    case 'WIDGET_DELETED':
    default:
      break;
  }
}
