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

/** El-çizimi duvar kağıdı (telefon çerçevesi + içinde satırlar). */
export function SketchWallpaper({ size = 26, color }: IconProps) {
  const { colors } = useTheme();
  const c = color ?? colors.textMuted;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M7.2,2.6 Q12,2.2 16.8,2.6 Q17.3,12 16.8,21.4 Q12,21.8 7.2,21.4 Q6.7,12 7.2,2.6 Z M9.6,8.4 Q12,8.2 14.4,8.4 M9.6,11.6 Q12,11.4 14.4,11.6 M9.6,14.8 Q11.2,14.6 12.8,14.8"
        stroke={c}
        strokeWidth={1.5}
        fill="none"
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

/**
 * El-çizimi "dur" eli — tek path, açık avuç silüeti (4 parmak + başparmak).
 * `HandSketch` (`SketchOnboardingIcons.tsx`) 88px'e ayarlı, ince parıltı çizgileri
 * 22-24px'te bulanıklaşır — `w2.2-ux.md` §2.2 bu yüzden yeni, süslemesiz bir ikon istiyor.
 */
export function SketchHandStop({ size = 26, color }: IconProps) {
  const { colors } = useTheme();
  const c = color ?? colors.textMuted;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M8.6,21.6 Q8.2,17 8.6,12.4 Q6.4,11.6 5.4,9.4 Q4.8,7.8 6.2,7 Q7.6,6.4 8.8,8.4 Q8.4,5.6 9.4,3.2 Q10,2 10.7,3.4 Q11.2,5.4 10.9,8 Q11.6,5.2 12.4,3.4 Q13,2.2 13.6,3.6 Q14,5.8 13.5,8.4 Q14.3,6 15.1,4.4 Q15.7,3.2 16.2,4.8 Q16.5,7 15.8,9.4 Q16.6,8.6 17.2,10 Q17.6,11.4 16.6,12.6 Q15.6,13.8 15.3,16.4 Q15.5,19 15.2,21.6 Z"
        stroke={c}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
