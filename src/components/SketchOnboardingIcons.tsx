import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

type Props = { size?: number; color?: string };

function useStroke(color?: string) {
  const { colors } = useTheme();
  return {
    stroke: color ?? colors.accent,
    strokeWidth: 1.8,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

/** Karakalem çan (çalan). */
export function BellSketch({ size = 88, color }: Props) {
  const s = useStroke(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M7,16 Q6.4,13.5 7,10.8 Q7.2,6 12,5.4 Q16.8,6 17,10.8 Q17.6,13.5 17,16 Q12,16.6 7,16 Z"
        {...s}
      />
      <Path d="M9.6,18 Q12,20.4 14.4,18" {...s} />
      <Path d="M12,5.4 L12,3.3 M10.8,3.4 Q12,2.6 13.2,3.4" {...s} />
      <Path d="M4,9 Q5,7 5.6,5.6 M20,9 Q19,7 18.4,5.6" {...s} opacity={0.5} />
    </Svg>
  );
}

/** Karakalem alev. */
export function FlameSketch({ size = 88, color }: Props) {
  const s = useStroke(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12,3 Q15.2,8 13.6,12 Q12.6,14 11,12.6 Q10.4,11.6 11,10.6 Q8.4,12.6 9,16.2 Q9.6,20.2 13,20 Q17.2,19.6 16.6,15 Q16,9 12,3 Z"
        {...s}
      />
    </Svg>
  );
}

/** Karakalem el (dokunan). */
export function HandSketch({ size = 88, color }: Props) {
  const s = useStroke(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M9,20.5 Q8.4,15.5 9,11.2 Q9.2,9.9 10.3,10.2 Q10.5,7.9 11.6,7.9 Q12.7,7.9 12.8,9.8 Q12.9,5.8 14,5.8 Q15.1,5.8 15.1,9.8 Q15.5,8.4 16.6,9 Q17.5,9.5 17.4,13.2 Q17.2,18.5 14,20.5 Q11.3,21.8 9,20.5 Z"
        {...s}
      />
      <Path d="M6.5,7 L5,5.5 M9,5 L8.5,3 M12.5,4 L13,2.2" {...s} opacity={0.5} />
    </Svg>
  );
}
