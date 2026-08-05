import { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Fonts } from '@/constants/fonts';
import { WALLPAPER_ASPECT, type WallpaperStyle } from '@/constants/wallpapers';

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
 * Ölçüler `width` üzerinden oransal — 360px önizleme ile 1080px dışa aktarım
 * arasında düzen birebir aynı kalıyor.
 */
export const WallpaperCanvas = forwardRef<View, Props>(function WallpaperCanvas(
  { text, author, style, width },
  ref
) {
  const height = Math.round(width * WALLPAPER_ASPECT);
  const s = width / 1080; // dışa aktarım genişliğine göre ölçek

  // Yıldız serpintisi sabit bir desenden geliyor: her render'da yeniden
  // dağılsaydı önizleme ile kaydedilen görsel farklı olurdu.
  const speckles = useMemo(() => SPECKLE_SEED.map(([x, y, r]) => ({ x, y, r })), []);

  const quoteSize = Math.max(15, Math.round(78 * s));
  const authorSize = Math.max(10, Math.round(36 * s));
  const markSize = Math.max(7, Math.round(24 * s));

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

      {/* Metin bloğu ortanın hafif üstünde: telefonun alt üçtebiri uygulama
          simgelerine ait, oraya yazı koymak okunmaz hale getiriyor. */}
      <View
        style={[
          styles.content,
          { paddingHorizontal: width * 0.13, paddingTop: height * 0.3 },
        ]}>
        <Text
          style={{
            fontFamily: Fonts.quote,
            fontSize: quoteSize,
            lineHeight: quoteSize * 1.42,
            color: style.text,
            letterSpacing: 0.5,
          }}>
          {text}
        </Text>

        <View style={{ marginTop: height * 0.035, alignItems: 'flex-end' }}>
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: authorSize,
              color: style.muted,
              letterSpacing: 0.5,
            }}>
            — {author}
          </Text>
        </View>
      </View>

      {/* köşe imzası: paylaşıldığında uygulamayı hatırlatır, okumayı bozmaz */}
      <View style={[styles.mark, { bottom: height * 0.055 }]}>
        <Text
          style={{
            fontFamily: Fonts.body,
            fontSize: markSize,
            color: style.muted,
            opacity: 0.65,
            letterSpacing: 1.2,
          }}>
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
  mark: {
    position: 'absolute',
    alignSelf: 'center',
  },
});
