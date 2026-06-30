import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';
import { wavyLinePath } from '@/utils/sketch';

type Props = {
  color?: string;
  opacity?: number;
  height?: number;
};

/** Yazar adı / başlık altına dalgalı el-çizimi alt çizgi. */
export function SketchUnderline({ color, opacity = 0.6, height = 8 }: Props) {
  const { colors } = useTheme();
  const [w, setW] = useState(0);
  const stroke = color ?? colors.accent;

  return (
    <View
      style={[styles.wrap, { height }]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={height}>
          <Path
            d={wavyLinePath(w, (height - 2) / 2)}
            stroke={stroke}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
            opacity={opacity}
          />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
  },
});
