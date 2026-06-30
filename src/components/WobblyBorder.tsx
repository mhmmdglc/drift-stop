import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';
import { roughRectPath } from '@/utils/sketch';

type Props = {
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  dashed?: boolean;
  inset?: number;
  /** Çift çizgi (kalemle iki kez çizilmiş gibi). Varsayılan açık. */
  doubleStroke?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Ebeveynini dolduran, kalemle çiziktirilmiş gibi köşeli/titrek SVG kenar.
 * İki geçiş çizilir (ana + hafif kaymış ikinci hat) → karakalem hissi.
 */
export function WobblyBorder({
  stroke,
  strokeWidth = 1.6,
  fill = 'none',
  dashed = false,
  inset = 5,
  doubleStroke = true,
  style,
}: Props) {
  const { colors } = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const color = stroke ?? colors.accent;

  return (
    <View
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
      onLayout={(e) =>
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }>
      {size.w > 0 && size.h > 0 && (
        <Svg width={size.w} height={size.h}>
          <Path
            d={roughRectPath(size.w, size.h, inset, 0)}
            stroke={color}
            strokeWidth={strokeWidth}
            fill={fill}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={dashed ? '7 6' : undefined}
          />
          {doubleStroke && (
            <Path
              d={roughRectPath(size.w, size.h, inset + 2, 1)}
              stroke={color}
              strokeWidth={Math.max(0.8, strokeWidth - 0.6)}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.4}
            />
          )}
        </Svg>
      )}
    </View>
  );
}
