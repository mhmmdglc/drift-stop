import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';
import { cornerBracketPaths } from '@/utils/sketch';

type Props = {
  color?: string;
  strokeWidth?: number;
  len?: number;
  opacity?: number;
};

/** Bir bölgenin etrafına el-çizimi köşe parantezleri ( ⌐ ¬ ) — "düşünür burayı işaretledi". */
export function CornerBrackets({ color, strokeWidth = 1.6, len = 18, opacity = 0.75 }: Props) {
  const { colors } = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const c = color ?? colors.textMuted;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) =>
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }>
      {size.w > 0 && size.h > 0 && (
        <Svg width={size.w} height={size.h}>
          {cornerBracketPaths(size.w, size.h, len).map((d, i) => (
            <Path
              key={i}
              d={d}
              stroke={c}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={opacity}
            />
          ))}
        </Svg>
      )}
    </View>
  );
}
