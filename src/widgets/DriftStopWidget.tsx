import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { DarkColors } from '@/constants/colors';
import i18n from '@/i18n';
import { localizeAuthor } from '@/i18n/quoteLocalization';
import { quoteDisplayText } from '@/utils/quoteText';
import type { Quote } from '@/types/quote';

const MAX_LEN = 110;

// react-native-android-widget renkleri `#${string}` ister; DarkColors string olarak tiplenmiş, daraltıyoruz.
const C = {
  bg: DarkColors.background as `#${string}`,
  text: DarkColors.text as `#${string}`,
  muted: DarkColors.textMuted as `#${string}`,
  accent: DarkColors.accent as `#${string}`,
};

function clip(s: string): string {
  return s.length > MAX_LEN ? s.slice(0, MAX_LEN - 1).trimEnd() + '…' : s;
}

/**
 * Ana ekran widget'ı (Android). Native tarafta render edilir; tema hook'u kullanılamaz,
 * bu yüzden renkler doğrudan DarkColors'tan alınır. Tıklayınca deep link ile sözü açar.
 */
export function DriftStopWidget({ quote }: { quote: Quote | null }) {
  // Headless render'da i18n/locale beklenmedik olabilir; asla throw etmesin.
  const locale = i18n.locale ?? 'tr';
  let text: string;
  let author: string;
  try {
    text = quote ? clip(quoteDisplayText(quote, locale)) : i18n.t('widget.defaultQuote');
    author = quote
      ? `— ${localizeAuthor(quote.author, locale)}`
      : `— ${i18n.t('widget.defaultAuthor')}`;
  } catch {
    text = quote?.text ?? 'Sürüklenme. Geri dön.';
    author = quote?.author ? `— ${quote.author}` : '— DriftStop';
  }
  const uri = `driftstop://quote/${quote?.id ?? ''}`;

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: C.bg,
        borderRadius: 16,
        padding: 16,
      }}>
      <TextWidget text="🔥 DriftStop" style={{ fontSize: 11, color: C.muted }} />
      <TextWidget text={text} style={{ fontSize: 18, color: C.text }} />
      <TextWidget text={author} style={{ fontSize: 12, color: C.accent }} />
    </FlexWidget>
  );
}
