import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { WobblyBorder } from '@/components/WobblyBorder';
import { Spacing } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import type { QuoteCategory } from '@/types/quote';

export function CategoryBadge({ category }: { category: QuoteCategory }) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <ThemedText variant="label" tone="accent" style={styles.star}>
        ✦
      </ThemedText>
      <View style={styles.pill}>
        <WobblyBorder stroke={colors.accent} strokeWidth={1.2} inset={3} />
        <ThemedText variant="label" tone="accent">
          {t(`quote.categories.${category}`)}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  star: {
    fontSize: 14,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
});
