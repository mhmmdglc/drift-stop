import { type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { Paper } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';
import { grainDots } from '@/utils/sketch';

type Props = {
  children: ReactNode;
  /** Defter çizgilerini göster (varsayılan true). */
  lines?: boolean;
  /** Sol kenar marjı çizgisini göster (varsayılan true). */
  margin?: boolean;
  /** Grain/noise dokusu (varsayılan true). */
  grain?: boolean;
};

/**
 * Tüm ekranların altına serilen "defter sayfası" zemini.
 * - Sıcak koyu/parşömen arka plan
 * - 32px'de bir soluk yatay defter çizgisi
 * - 40px'de soluk kırmızı kenar marjı
 *
 * Not: grain/noise PNG dokusu Faz 7'de eklenecek (şimdilik sadece çizgiler).
 */
export function PaperBackground({ children, lines = true, margin = true, grain = true }: Props) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();

  const ys: number[] = [];
  for (let y = Paper.lineGap; y < height; y += Paper.lineGap) ys.push(y);

  const dots = grain ? grainDots(width, height, 90) : [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={width} height={height}>
          {dots.map((d, i) => (
            <Circle key={`g${i}`} cx={d.x} cy={d.y} r={d.r} fill={colors.text} opacity={d.o} />
          ))}
          {lines &&
            ys.map((y) => (
              <Line
                key={y}
                x1={0}
                y1={y}
                x2={width}
                y2={y}
                stroke={colors.faintLine}
                strokeWidth={1}
                opacity={0.3}
              />
            ))}
          {margin && (
            <Line
              x1={Paper.marginX}
              y1={0}
              x2={Paper.marginX}
              y2={height}
              stroke={colors.fire}
              strokeWidth={1}
              opacity={0.2}
            />
          )}
        </Svg>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
