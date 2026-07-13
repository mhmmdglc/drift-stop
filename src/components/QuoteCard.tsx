import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryBadge } from '@/components/CategoryBadge';
import { CornerBrackets } from '@/components/CornerBrackets';
import { Doodle } from '@/components/Doodle';
import { SketchHeart, SketchShare } from '@/components/SketchIcons';
import { SketchUnderline } from '@/components/SketchUnderline';
import { ThemedText } from '@/components/ThemedText';
import { WobblyBorder } from '@/components/WobblyBorder';
import { Spacing } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';
import { localizeAuthor, localizeOrigin } from '@/i18n/quoteLocalization';
import { useTranslation } from '@/i18n/useTranslation';
import { quoteDisplayText } from '@/utils/quoteText';
import type { Quote } from '@/types/quote';

type Props = {
  quote: Quote;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onShare?: () => void;
  showActions?: boolean;
};

export function QuoteCard({
  quote,
  isFavorite = false,
  onToggleFavorite,
  onShare,
  showActions = true,
}: Props) {
  const { colors } = useTheme();
  const { t, locale } = useTranslation();

  const text = quoteDisplayText(quote, locale);

  return (
    <View style={styles.card}>
      <WobblyBorder stroke={colors.accent} strokeWidth={1.6} inset={6} />

      {/* tek, hafif doodle — kalabalık yapmadan "defter" hissi */}
      <View style={styles.doodleTR}>
        <Doodle kind="star" size={16} color={colors.accent} opacity={0.35} />
      </View>

      <View style={styles.topRow}>
        <CategoryBadge category={quote.category} />
      </View>

      {/* alıntı bloğu — köşe parantezleri içinde */}
      <View style={styles.quoteWrap}>
        <CornerBrackets color={colors.textMuted} len={16} opacity={0.7} />
        <ThemedText variant="quoteLarge" style={styles.quote}>
          {text}
        </ThemedText>
      </View>

      <View style={styles.authorBlock}>
        <ThemedText variant="author" tone="textMuted">
          {t('quote.authorPrefix')} {localizeAuthor(quote.author, locale)}
        </ThemedText>
        <View style={styles.underline}>
          <SketchUnderline />
        </View>
        <ThemedText variant="label" tone="textMuted">
          {quote.originEmoji} {localizeOrigin(quote.origin, locale)} {t('quote.originSeparator')}{' '}
          {t(`quote.eras.${quote.era}`)}
        </ThemedText>
      </View>

      {showActions && (
        <View style={styles.actions}>
          <Pressable
            onPress={onToggleFavorite}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t(isFavorite ? 'home.favoriteRemove' : 'home.favoriteAdd')}
            accessibilityState={{ selected: isFavorite }}>
            <SketchHeart size={26} filled={isFavorite} />
          </Pressable>
          <Pressable
            onPress={onShare}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('home.shareQuote')}>
            <SketchShare size={26} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    gap: Spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  quoteWrap: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  quote: {
    textAlign: 'left',
  },
  authorBlock: {
    gap: Spacing.xs,
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
    maxWidth: '80%',
  },
  underline: {
    width: 140,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  doodleTR: {
    position: 'absolute',
    top: 10,
    right: 14,
  },
});
