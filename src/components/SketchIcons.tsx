import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

type IconProps = {
  size?: number;
  color?: string;
};

/** El-çizimi kalp. filled=true ise mürekkep lekesi gibi dolu. */
export function SketchHeart({ size = 26, color, filled = false }: IconProps & { filled?: boolean }) {
  const { colors } = useTheme();
  const c = color ?? (filled ? colors.fire : colors.textMuted);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12,20.5 C12,20.5 3.5,14.5 3.5,8.5 C3.5,5.3 6,3.8 8.3,4.9 C10,5.7 12,8.2 12,8.2 C12,8.2 14,5.7 15.7,4.9 C18,3.8 20.5,5.3 20.5,8.5 C20.5,14.5 12,20.5 12,20.5 Z"
        stroke={c}
        strokeWidth={1.6}
        fill={filled ? c : 'none'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** El-çizimi paylaş (yukarı ok + kutu). */
export function SketchShare({ size = 26, color }: IconProps) {
  const { colors } = useTheme();
  const c = color ?? colors.textMuted;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6,11 Q5.6,15 6,19 Q12,19.4 18,19 Q18.4,15 18,11 M12,15.5 Q11.8,9 12,3.2 M8,7 L12,3 L16,7"
        stroke={c}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
