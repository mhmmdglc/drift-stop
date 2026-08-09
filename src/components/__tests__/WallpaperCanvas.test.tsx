/// <reference types="jest" />
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { WallpaperCanvas } from '@/components/WallpaperCanvas';
import {
  DEFAULT_WALLPAPER_STYLE,
  WALLPAPER_EXPORT_WIDTH,
  wallpaperQuoteFontSize,
} from '@/constants/wallpapers';

// Paketteki en uzun söz kadar (id 892, Herakleitos) — 203 karakter.
const LONG_QUOTE =
  'Karakter kaderdir; insanın başına gelenler onun ne olduğunun sonucudur ve bu ' +
  'yüzden hiç kimse kendi payına düşenden kaçamaz, çünkü o pay zaten kendisidir, ' +
  'her gün yeniden seçilir durur.';

const SHORT_QUOTE = 'Kısa söz.';
const PREVIEW_WIDTH = 190;

function renderCanvas(text: string) {
  return render(
    <WallpaperCanvas
      text={text}
      author="Herakleitos"
      style={DEFAULT_WALLPAPER_STYLE}
      width={PREVIEW_WIDTH}
    />
  );
}

describe('WallpaperCanvas', () => {
  it('keeps the reading order quote → author → mark even for a 200+ character quote', async () => {
    const view = await renderCanvas(LONG_QUOTE);

    const texts = view.getAllByRole('text');
    expect(texts).toHaveLength(3);
    expect(texts[0]).toHaveTextContent(LONG_QUOTE);
    expect(texts[1]).toHaveTextContent(/Herakleitos/);
    expect(texts[2]).toHaveTextContent('DriftStop');
  });

  // İmza eskiden `position: absolute` + sabit `bottom` ile çakılıydı ve 11 satırlık
  // bir sözde yazarın üstüne biniyordu. Akışta kaldığı sürece çakışması imkansız.
  it('lays the mark out in flow instead of pinning it over the text', async () => {
    const view = await renderCanvas(LONG_QUOTE);

    const mark = view.getAllByRole('text')[2];
    expect(StyleSheet.flatten(mark.props.style).position).toBeUndefined();
  });

  it('shrinks a long quote so it still fits above the mark', async () => {
    const long = await renderCanvas(LONG_QUOTE);
    const short = await renderCanvas(SHORT_QUOTE);

    const longSize = StyleSheet.flatten(long.getAllByRole('text')[0].props.style).fontSize;
    const shortSize = StyleSheet.flatten(short.getAllByRole('text')[0].props.style).fontSize;

    expect(longSize).toBeLessThan(shortSize);
  });

  // captureRef ekrandaki görünümü olduğu gibi ölçekleyip dışa aktarıyor: önizlemede
  // punto alt sınırına çarpsaydı kaydedilen dosyanın düzeni de orantısız olurdu.
  it('scales the type with the canvas instead of clamping it to a legibility floor', async () => {
    const view = await renderCanvas(SHORT_QUOTE);

    const quote = StyleSheet.flatten(view.getAllByRole('text')[0].props.style);
    expect(quote.fontSize).toBeCloseTo(
      (wallpaperQuoteFontSize(SHORT_QUOTE.length) * PREVIEW_WIDTH) / WALLPAPER_EXPORT_WIDTH,
      5
    );
  });
});
