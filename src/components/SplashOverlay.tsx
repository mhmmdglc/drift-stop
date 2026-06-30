import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Fonts, FontSizes } from '@/constants/fonts';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import { brushStrokePath } from '@/utils/sketch';

const DURATION = 2200;
const STROKE_W = 180;
const STROKE_LEN = 220; // yol uzunluğundan büyük → tam reveal

const AnimatedPath = Animated.createAnimatedComponent(Path);

export function SplashOverlay({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const nameOpacity = useSharedValue(0);
  const nameY = useSharedValue(10);
  const draw = useSharedValue(1); // 1 = çizilmemiş, 0 = tam çizili
  const taglineOpacity = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    nameOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
    nameY.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });
    draw.value = withDelay(300, withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) }));
    taglineOpacity.value = withDelay(1000, withTiming(1, { duration: 600 }));

    fade.value = withDelay(
      DURATION - 350,
      withTiming(0, { duration: 350 }, (finished) => {
        if (finished) runOnJS(onDone)();
      })
    );
  }, [fade, nameOpacity, nameY, draw, taglineOpacity, onDone]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const nameStyle = useAnimatedStyle(() => ({
    opacity: nameOpacity.value,
    transform: [{ translateY: nameY.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));
  const strokeProps = useAnimatedProps(() => ({ strokeDashoffset: draw.value * STROKE_LEN }));

  return (
    <Animated.View
      style={[styles.root, { backgroundColor: colors.background }, rootStyle]}
      pointerEvents="none">
      <Animated.Text
        style={[styles.name, { color: colors.text, fontFamily: Fonts.display }, nameStyle]}>
        {t('app.name')}
      </Animated.Text>

      <Svg width={STROKE_W} height={10} style={styles.stroke}>
        <AnimatedPath
          d={brushStrokePath(STROKE_W, 10)}
          stroke={colors.accent}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={STROKE_LEN}
          animatedProps={strokeProps}
        />
      </Svg>

      <Animated.Text
        style={[styles.tagline, { color: colors.accent, fontFamily: Fonts.body }, taglineStyle]}>
        {t('app.tagline')}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  name: {
    fontSize: FontSizes.title + 8,
    letterSpacing: 2,
  },
  stroke: {
    marginTop: 8,
  },
  tagline: {
    fontSize: FontSizes.author,
    marginTop: 16,
    letterSpacing: 1,
  },
});
