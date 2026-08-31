import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { DarkColors } from '@/constants/colors';
import i18n from '@/i18n';
import { localizeAuthor } from '@/i18n/quoteLocalization';
import { quoteDisplayText } from '@/utils/quoteText';
import type { Quote } from '@/types/quote';

// react-native-android-widget renkleri `#${string}` ister; DarkColors string olarak tiplenmiş, daraltıyoruz.
const C = {
  bg: DarkColors.background as `#${string}`,
  text: DarkColors.text as `#${string}`,
  muted: DarkColors.textMuted as `#${string}`,
  accent: DarkColors.accent as `#${string}`,
};

/**
 * Widget hem ana ekranda (4x2 ≈ 110dp) hem kilit ekranında (4x3 ≈ 190dp) yaşıyor.
 * Kilit ekranı hücresi belirgin şekilde daha uzun; sabit MAX_LEN orada sözü
 * gereksiz yere kesip alanın yarısını boş bırakıyordu. Bu yüzden ölçüyü
 * widget'ın kendi yüksekliğinden türetiyoruz.
 */
function metricsFor(height: number, width: number) {
  if (height >= 170) return { maxLen: 200, fontSize: 19, gap: 12 }; // kilit ekranı / uzun
  if (height >= 100) return { maxLen: 110, fontSize: 18, gap: 10 }; // varsayılan 4x2
  return { maxLen: width >= 200 ? 70 : 50, fontSize: 15, gap: 6 }; // sığ hücre
}

function clip(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen - 1).trimEnd() + '…' : s;
}

/**
 * Ana ekran ve kilit ekranı widget'ı (Android). Native tarafta render edilir; tema
 * hook'u kullanılamaz, bu yüzden renkler doğrudan DarkColors'tan alınır.
 * Tıklayınca deep link ile sözü açar (kilit ekranından açılışta sistem kimlik doğrulaması ister).
 */
export function DriftStopWidget({
  quote,
  height = 110,
  width = 250,
}: {
  quote: Quote | null;
  height?: number;
  width?: number;
}) {
  const { maxLen, fontSize, gap } = metricsFor(height, width);

  // Headless render'da i18n/locale beklenmedik olabilir; asla throw etmesin.
  const locale = i18n.locale ?? 'tr';
  let text: string;
  let author: string;
  try {
    text = quote ? clip(quoteDisplayText(quote, locale), maxLen) : i18n.t('widget.defaultQuote');
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
        // Ortalanmış blok her yükseklikte derli toplu duruyor; space-between uzun
        // hücrede söz ile yazar arasında kopukluk yaratıyordu.
        justifyContent: 'center',
        backgroundColor: C.bg,
        borderRadius: 16,
        padding: 16,
      }}>
      <TextWidget
        text="🔥 DriftStop"
        style={{ fontSize: 11, color: C.muted, marginBottom: gap }}
      />
      <TextWidget text={text} style={{ fontSize, color: C.text, marginBottom: gap }} />
      <TextWidget text={author} style={{ fontSize: 12, color: C.accent }} />
    </FlexWidget>
  );
}
