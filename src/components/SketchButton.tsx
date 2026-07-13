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
};

/** Aceleyle bir kutu çizilmiş gibi görünen buton. Basınca ink-stamp ölçek animasyonu. */
export function SketchButton({
  label,
  onPress,
  stroke,
  textTone = 'accent',
  disabled = false,
  style,
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
        style={[styles.btn, { opacity: disabled ? 0.4 : 1 }, style]}>
        <View style={StyleSheet.absoluteFill}>
          <WobblyBorder stroke={stroke ?? colors.accent} strokeWidth={1.5} />
        </View>
        <ThemedText variant="body" tone={textTone} style={styles.label}>
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
  label: {
    letterSpacing: 1,
  },
});
