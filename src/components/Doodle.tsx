import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

export type DoodleKind = 'star' | 'arrow' | 'dots' | 'cross' | 'scribble' | 'spiral';

type Props = {
  kind: DoodleKind;
  size?: number;
  color?: string;
  opacity?: number;
};

/** Kazara serpilmiş gibi küçük el-çizimi süslemeler (24x24 viewBox). */
export function Doodle({ kind, size = 16, color, opacity = 0.5 }: Props) {
  const { colors } = useTheme();
  const c = color ?? colors.accent;
  const common = {
    stroke: c,
    strokeWidth: 1.5,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      {kind === 'star' && (
        <Path d="M12,3 Q13.2,10.8 21,12 Q13.2,13.2 12,21 Q10.8,13.2 3,12 Q10.8,10.8 12,3 Z" {...common} />
      )}
      {kind === 'arrow' && (
        <Path d="M3,15 Q11,9 19,12 M14,7 L20.5,12 L14,17" {...common} />
      )}
      {kind === 'cross' && <Path d="M6,6 L18,18 M18,6 L6,18" {...common} />}
      {kind === 'scribble' && (
        <Path d="M3,12 Q6,6 9,12 Q12,18 15,12 Q18,6 21,12" {...common} />
      )}
      {kind === 'spiral' && (
        <Path d="M12,12 Q12,8 16,9 Q20,10 18,15 Q16,20 10,18 Q4,16 6,9 Q8,3 15,5" {...common} />
      )}
      {kind === 'dots' && (
        <>
          <Circle cx="8" cy="9" r="1.6" fill={c} />
          <Circle cx="14" cy="11" r="1.6" fill={c} />
          <Circle cx="10" cy="15" r="1.6" fill={c} />
          <Circle cx="16" cy="16" r="1.6" fill={c} />
        </>
      )}
    </Svg>
  );
}
