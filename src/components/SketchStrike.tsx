import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';
import { wavyLinePath } from '@/utils/sketch';

type Props = {
  children: ReactNode;
  color?: string;
  opacity?: number;
};

/**
 * İçeriğin üstünden geçen el-çizimi çizgi ("üstü çizili" fiyat için).
 *
 * `textDecorationLine: 'line-through'` yerine SVG: ekranın geri kalanı elle
 * çizilmiş bir defter, düz piksel çizgi oraya ait değil. Çizgi mutlak konumlu
 * ve ölçülen kutunun tam ortasından geçiyor, yani metnin akışını/yüksekliğini
 * hiç değiştirmiyor — yanındaki asıl fiyatla hizası bozulmasın.
 */
export function SketchStrike({ children, color, opacity = 0.9 }: Props) {
  const { colors } = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const stroke = color ?? colors.textMuted;
  const amplitude = 1.2;

  return (
    <View
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {children}
      {size.w > 0 && size.h > 0 && (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path
            d={wavyLinePath(size.w, amplitude)}
            translateY={size.h / 2 - (amplitude + 1)}
            stroke={stroke}
            strokeWidth={1.3}
            fill="none"
            strokeLinecap="round"
            opacity={opacity}
          />
        </Svg>
      )}
    </View>
  );
}
