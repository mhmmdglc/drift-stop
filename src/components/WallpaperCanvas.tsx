import { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Fonts } from '@/constants/fonts';
import {
  WALLPAPER_ASPECT,
  WALLPAPER_EXPORT_WIDTH,
  wallpaperQuoteFontSize,
  type WallpaperStyle,
} from '@/constants/wallpapers';

type Props = {
  text: string;
  author: string;
  style: WallpaperStyle;
  /** Önizleme genişliği. Dışa aktarımda captureRef bunu ölçekliyor. */
  width: number;
};

/**
 * Duvar kağıdının tek kaynağı: hem ekrandaki önizleme hem de kaydedilen dosya
 * bu bileşenden çıkıyor. Böylece "önizlemede başka, kayıtta başka" sınıfı
 * hatalar mümkün olmuyor.
 *
 * Ölçüler `width` üzerinden oransal — 190px önizleme ile 1080px dışa aktarım
 * arasında düzen birebir aynı kalıyor. Punto tabanları da dahil **hiçbir ölçüye
 * alt sınır konmuyor**: `captureRef` ekrandaki görünümü olduğu gibi ölçekleyerek
 * dışa aktardığı için, önizlemede okunaklılık adına büyütülen bir punto
 * kaydedilen dosyada da orantısız kalıyordu (yazarı ve imzayı üst üste bindiren
 * hatanın kaynağı buydu).
 */
export const WallpaperCanvas = forwardRef<View, Props>(function WallpaperCanvas(
  { text, author, style, width },
  ref
) {
  const height = Math.round(width * WALLPAPER_ASPECT);
  const s = width / WALLPAPER_EXPORT_WIDTH; // dışa aktarım genişliğine göre ölçek

  // Yıldız serpintisi sabit bir desenden geliyor: her render'da yeniden
  // dağılsaydı önizleme ile kaydedilen görsel farklı olurdu.
  const speckles = useMemo(() => SPECKLE_SEED.map(([x, y, r]) => ({ x, y, r })), []);

  const quoteSize = wallpaperQuoteFontSize(text.length) * s;
  const authorSize = 36 * s;
  const markSize = 24 * s;

  const [from, to] = style.gradient;
  const rad = (style.angle * Math.PI) / 180;

  return (
    <View ref={ref} collapsable={false} style={[styles.root, { width, height }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient
            id="bg"
            x1="0"
            y1="0"
            x2={`${Math.cos(rad)}`}
            y2={`${Math.sin(rad) + 1}`}>
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#bg)" />

        {/* defter çizgileri — uygulamanın kağıt motifi, çok düşük opaklıkta */}
        {Array.from({ length: 26 }, (_, i) => {
          const y = ((i + 1) / 27) * height;
          return (
            <Line
              key={`l${i}`}
              x1={0}
              y1={y}
              x2={width}
              y2={y}
              stroke={style.line}
              strokeWidth={Math.max(0.5, s * 1.5)}
              opacity={0.35}
            />
          );
        })}

        {/* sol kenar boşluğu çizgisi */}
        <Line
          x1={width * 0.11}
          y1={0}
          x2={width * 0.11}
          y2={height}
          stroke={style.accent}
          strokeWidth={Math.max(0.5, s * 1.5)}
          opacity={0.18}
        />

        {style.speckles &&
          speckles.map((sp, i) => (
            <Circle
              key={`s${i}`}
              cx={sp.x * width}
              cy={sp.y * height}
              r={Math.max(0.6, sp.r * s * 3)}
              fill={style.text}
              opacity={0.16}
            />
          ))}
      </Svg>

      {/* Söz → yazar → imza tek bir akışta duruyor. İmza eskiden `position:
          absolute` ile alta çakılıydı ve uzun sözlerde yazarın üstüne biniyordu;
          akışta olunca çakışma dizgesel olarak imkansız.

          Boşluklar 3:7 oranında esniyor: kısa sözde blok ekranın üst üçte
          birinde kalıyor (telefonun alt üçtebiri uygulama simgelerine ait),
          uzun sözde iki boşluk da büzülerek metne yer açıyor. */}
      <View
        style={[
          styles.content,
          {
            paddingHorizontal: width * 0.13,
            paddingTop: height * 0.12,
            paddingBottom: height * 0.045,
          },
        ]}>
        <View style={styles.spacerTop} />

        {/* Sistem yazı tipi ölçeği kapalı: bu bir görsel, cihaz ayarı büyütünce
            dışa aktarılan duvar kağıdının düzeni bozuluyordu. */}
        <Text
          allowFontScaling={false}
          style={[
            styles.quote,
            {
              fontSize: quoteSize,
              lineHeight: quoteSize * 1.42,
              color: style.text,
              letterSpacing: quoteSize * 0.006,
            },
          ]}>
          {text}
        </Text>

        <View style={[styles.authorRow, { marginTop: height * 0.035 }]}>
          <Text
            allowFontScaling={false}
            style={[
              styles.author,
              { fontSize: authorSize, color: style.muted, letterSpacing: authorSize * 0.014 },
            ]}>
            — {author}
          </Text>
        </View>

        <View style={styles.spacerBottom} />

        {/* köşe imzası: paylaşıldığında uygulamayı hatırlatır, okumayı bozmaz */}
        <Text
          allowFontScaling={false}
          style={[
            styles.mark,
            { fontSize: markSize, color: style.muted, letterSpacing: markSize * 0.05 },
          ]}>
          DriftStop
        </Text>
      </View>
    </View>
  );
});

/** [x, y, yarıçap] — 0..1 aralığında normalize, sabit desen. */
const SPECKLE_SEED: readonly [number, number, number][] = [
  [0.18, 0.08, 0.5], [0.72, 0.05, 0.35], [0.41, 0.13, 0.28], [0.88, 0.17, 0.45],
  [0.09, 0.24, 0.3], [0.62, 0.28, 0.5], [0.31, 0.34, 0.25], [0.79, 0.39, 0.35],
  [0.15, 0.44, 0.4], [0.53, 0.49, 0.28], [0.91, 0.53, 0.3], [0.24, 0.58, 0.45],
  [0.67, 0.63, 0.28], [0.38, 0.69, 0.35], [0.83, 0.74, 0.4], [0.12, 0.79, 0.3],
  [0.58, 0.84, 0.45], [0.29, 0.89, 0.28], [0.75, 0.93, 0.35], [0.46, 0.97, 0.3],
];

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  // Esneyen boşluklar: 3/10 üstte, 7/10 altta → blok ortanın üstünde duruyor.
  spacerTop: { flex: 3 },
  spacerBottom: { flex: 7 },
  quote: { fontFamily: Fonts.quote },
  authorRow: { alignItems: 'flex-end' },
  author: { fontFamily: Fonts.body },
  mark: {
    fontFamily: Fonts.body,
    alignSelf: 'center',
    opacity: 0.65,
  },
});
