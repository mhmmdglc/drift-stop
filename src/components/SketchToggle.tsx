import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

import { WobblyBorder } from '@/components/WobblyBorder';
import { useTheme } from '@/hooks/use-theme';

const TRACK_W = 52;
const TRACK_H = 30;
const KNOB = 20;

type Props = {
  value: boolean;
  onChange: (next: boolean) => void;
  accessibilityLabel?: string;
};

/** Elle çizilmiş ray üzerinde kayan daire — karakalem toggle. */
export function SketchToggle({ value, onChange, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const progress = useDerivedValue(() => withTiming(value ? 1 : 0, { duration: 160 }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (TRACK_W - KNOB - 8) + 4 }],
  }));

  return (
    <Pressable
      onPress={() => onChange(!value)}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}>
      <View
        style={[
          styles.track,
          { backgroundColor: value ? colors.accent : 'transparent' },
        ]}>
        <WobblyBorder
          stroke={value ? colors.accent : colors.faintLine}
          strokeWidth={1.4}
          inset={2}
          doubleStroke={false}
        />
        <Animated.View
          style={[
            styles.knob,
            { backgroundColor: value ? colors.background : colors.textMuted },
            knobStyle,
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    justifyContent: 'center',
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
  },
});
