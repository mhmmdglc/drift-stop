import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { getQuoteById, QUOTES } from '@/data/quotes';
import { getJSON, StorageKeys } from '@/utils/storage';
import type { Quote } from '@/types/quote';
import { DriftStopWidget } from './DriftStopWidget';

function randomQuote(): Quote | null {
  return QUOTES.length ? QUOTES[Math.floor(Math.random() * QUOTES.length)] : null;
}

/**
 * Widget yaşam döngüsü işleyicisi (headless çalışabilir).
 * Kullanıcının uygulamada gördüğü SON sözü gösterir (seenHistory[0] = en yeni).
 * Geçmiş yoksa veya storage headless bağlamda okunamazsa rastgele söze düşer.
 *
 * ÖNEMLİ: `renderWidget` HER durumda çağrılır. Aksi halde bir hata olursa
 * widget boş/şeffaf kalır. Bu yüzden tüm veri erişimi try/catch içinde.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  if (props.widgetAction === 'WIDGET_DELETED') return;

  let quote: Quote | null = null;
  try {
    const history = await getJSON<number[]>(StorageKeys.seenHistory, []);
    const lastId = history && history.length ? history[0] : undefined;
    if (lastId != null) quote = getQuoteById(lastId) ?? null;
  } catch {
    // headless bağlamda AsyncStorage okunamadı — sorun değil, aşağıda rastgeleye düşer.
    quote = null;
  }

  if (!quote) quote = randomQuote();

  try {
    props.renderWidget(<DriftStopWidget quote={quote} />);
  } catch {
    // Render bile başarısızsa yapacak bir şey yok; en azından çökmüyoruz.
  }
}
