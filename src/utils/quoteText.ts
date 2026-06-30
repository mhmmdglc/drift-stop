import type { Quote } from '@/types/quote';

/** Görüntülenecek metin: Türkçe locale'de textTr, değilse text. */
export function quoteDisplayText(quote: Quote, locale: string): string {
  return locale.startsWith('tr') && quote.textTr ? quote.textTr : quote.text;
}
