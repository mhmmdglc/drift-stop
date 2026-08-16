import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/ThemedText';
import { WobblyBorder } from '@/components/WobblyBorder';
import { Spacing } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  onPress?: () => void;
  stroke?: string;
  textTone?: 'text' | 'textMuted' | 'accent' | 'fire';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * `large`: /reckoning'in iki ana eylemi gibi ekranın TEK eylemi olan butonlar için —
   * paywall paket kartları ağırlığında (`w1.3-ux.md` §3). Mevcut `default` kullanımlar
   * DEĞİŞMEZ, bu yalnızca ek bir varyant.
   */
  size?: 'default' | 'large';
};

/** Aceleyle bir kutu çizilmiş gibi görünen buton. Basınca ink-stamp ölçek animasyonu. */
export function SketchButton({
  label,
  onPress,
  stroke,
  textTone = 'accent',
  disabled = false,
  style,
  size = 'default',
}: Props) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => {
          scale.value = withTiming(0.96, { duration: 120 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 120 });
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        style={[
          styles.btn,
          size === 'large' && styles.btnLarge,
          { opacity: disabled ? 0.4 : 1 },
          style,
        ]}>
        <View style={StyleSheet.absoluteFill}>
          <WobblyBorder stroke={stroke ?? colors.accent} strokeWidth={1.5} />
        </View>
        <ThemedText variant={size === 'large' ? 'heading' : 'body'} tone={textTone} style={styles.label}>
          {label}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLarge: {
    minHeight: 64,
    paddingVertical: Spacing.lg,
  },
  label: {
    letterSpacing: 1,
  },
});
