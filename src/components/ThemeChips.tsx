import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { WobblyBorder } from '@/components/WobblyBorder';
import { Spacing } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import { QUOTE_TAGS, type QuoteTag } from '@/types/quote';

type Props = {
  selected: QuoteTag[];
  onToggle: (tag: QuoteTag) => void;
};

/** 8 temalı çoklu-seçim baloncukları (onboarding + ayarlar). */
export function ThemeChips({ selected, onToggle }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const set = new Set(selected);

  return (
    <View style={styles.wrap}>
      {QUOTE_TAGS.map((tag) => {
        const on = set.has(tag);
        return (
          <Pressable
            key={tag}
            onPress={() => onToggle(tag)}
            style={styles.chip}
            hitSlop={4}
            accessibilityRole="checkbox"
            accessibilityLabel={t(`themes.${tag}`)}
            accessibilityState={{ checked: on }}>
            <WobblyBorder
              stroke={on ? colors.accent : colors.faintLine}
              strokeWidth={on ? 1.6 : 1.2}
              inset={3}
              doubleStroke={on}
            />
            <ThemedText variant="body" tone={on ? 'accent' : 'textMuted'}>
              {t(`themes.${tag}`)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    margin: 2,
  },
});
