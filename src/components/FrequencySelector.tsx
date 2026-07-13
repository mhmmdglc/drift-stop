import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { WobblyBorder } from '@/components/WobblyBorder';
import { Spacing } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';
import { FREQUENCY_OPTIONS, type Frequency } from '@/types/settings';

type Props = {
  value: Frequency;
  onChange: (next: Frequency) => void;
};

/** El-çizimi baloncuklar — seçili değerin etrafında daire. */
export function FrequencySelector({ value, onChange }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      {FREQUENCY_OPTIONS.map((opt) => {
        const selected = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={styles.bubble}
            hitSlop={6}
            accessibilityRole="radio"
            accessibilityLabel={String(opt)}
            accessibilityState={{ checked: selected }}>
            {selected && <WobblyBorder stroke={colors.accent} strokeWidth={1.6} inset={2} />}
            <ThemedText variant="author" tone={selected ? 'accent' : 'textMuted'}>
              {opt}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  bubble: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
