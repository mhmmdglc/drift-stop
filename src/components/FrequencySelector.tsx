import { LockSimple } from 'phosphor-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { WobblyBorder } from '@/components/WobblyBorder';
import { Spacing } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import { FREQUENCY_OPTIONS, type Frequency } from '@/types/settings';

type Props = {
  value: Frequency;
  onChange: (next: Frequency) => void;
  /** Pro'ya özel (kilitli) seçenekler — görünür ama seçilemez, dokununca onLockedPress. */
  lockedValues?: readonly Frequency[];
  onLockedPress?: () => void;
};

/** El-çizimi baloncuklar — seçili değerin etrafında daire, kilitli seçeneklerde kilit rozeti. */
export function FrequencySelector({ value, onChange, lockedValues = [], onLockedPress }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      {FREQUENCY_OPTIONS.map((opt) => {
        const selected = opt === value;
        const locked = lockedValues.includes(opt);
        return (
          <Pressable
            key={opt}
            onPress={() => (locked ? onLockedPress?.() : onChange(opt))}
            style={styles.bubble}
            hitSlop={6}
            accessibilityRole="radio"
            accessibilityLabel={
              locked ? `${opt} — ${t('settings.notifications.lockedOption')}` : String(opt)
            }
            accessibilityState={{ checked: selected, disabled: locked }}>
            {selected && !locked && (
              <WobblyBorder stroke={colors.accent} strokeWidth={1.6} inset={2} />
            )}
            <ThemedText variant="author" tone={selected && !locked ? 'accent' : 'textMuted'}>
              {opt}
            </ThemedText>
            {locked && (
              <View style={styles.lockBadge}>
                <LockSimple size={11} color={colors.accent} weight="fill" />
              </View>
            )}
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
  lockBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
});
