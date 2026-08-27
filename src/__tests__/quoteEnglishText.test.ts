/// <reference types="jest" />
/// <reference types="node" />
import quotes from '@/data/quotes.json';

/**
 * Paketlenmiş sözlerin İngilizce gövdesi gerçekten İngilizce olmalı.
 *
 * `utils/quoteText.ts` Türkçe olmayan her locale'de `text` alanını gösteriyor.
 * 2026-08-27'ye kadar bu alanın **194'ünde Türkçe metin** duruyordu — `textTr` ile
 * birebir aynı. Kod doğruydu, veri yanlıştı. Sonuç: İngilizce, İspanyolca,
 * Almanca, Fransızca ve İtalyanca kullanan herkes her **beş sözden birinde**
 * Türkçe bir metin görüyordu; uygulama çok dilli değil, bozuk görünüyordu.
 *
 * `tsc` de testler de bunu göremezdi çünkü ortada tip ya da mantık hatası yok.
 * Yalnız verinin kendisine bakan bir test yakalayabilir — bu.
 */

type Quote = { id: number; text: string; textTr: string; author: string };
const all = quotes as unknown as Quote[];

/** Türkçe'ye özgü harfler. `ö`/`ü` Almanca'da da var, onları saymıyoruz. */
const TURKISH_ONLY = /[ğşıİĞŞÇç]/;

/** Özel isimler İngilizce metinde de Türkçe harf taşıyabilir. */
const PROPER_NOUNS = ['Hızır'];

describe('bundled quotes have real English text', () => {
  it('never reuses the Turkish string as the English one', () => {
    const duplicated = all.filter((q) => q.text.trim() === q.textTr.trim()).map((q) => q.id);

    expect(duplicated).toEqual([]);
  });

  it('has no Turkish-only letters left in the English field', () => {
    const offenders = all
      .filter((q) => TURKISH_ONLY.test(q.text))
      .filter((q) => !PROPER_NOUNS.some((n) => q.text.includes(n)))
      .map((q) => ({ id: q.id, text: q.text.slice(0, 60) }));

    expect(offenders).toEqual([]);
  });

  it('gives every quote both languages', () => {
    const empty = all.filter((q) => !q.text?.trim() || !q.textTr?.trim()).map((q) => q.id);

    expect(empty).toEqual([]);
  });
});
