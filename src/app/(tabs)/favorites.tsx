import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaperBackground } from '@/components/PaperBackground';
import { SketchUnderline } from '@/components/SketchUnderline';
import { ThemedText } from '@/components/ThemedText';
import { WobblyBorder } from '@/components/WobblyBorder';
import { Spacing } from '@/constants/layout';
import { localizeAuthor } from '@/i18n/quoteLocalization';
import { quoteDisplayText } from '@/utils/quoteText';
import { getQuoteById } from '@/data/quotes';
import { useFavorites } from '@/hooks/useFavorites';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import type { Quote } from '@/types/quote';

export default function FavoritesScreen() {
  const { colors } = useTheme();
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { ids, remove } = useFavorites();

  const quotes = useMemo(
    () => ids.map((id) => getQuoteById(id)).filter((q): q is Quote => !!q),
    [ids]
  );

  const confirmRemove = (quote: Quote) => {
    Alert.alert(t('favorites.screenTitle'), t('favorites.removeConfirm'), [
      { text: t('favorites.removeNo'), style: 'cancel' },
      { text: t('favorites.removeYes'), style: 'destructive', onPress: () => remove(quote.id) },
    ]);
  };

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText variant="heading">{t('favorites.screenTitle')}</ThemedText>
          <View style={styles.headerUnderline}>
            <SketchUnderline />
          </View>
        </View>

        {quotes.length === 0 ? (
          <View style={styles.empty}>
            <ThemedText variant="quote" tone="textMuted" style={styles.emptyTitle}>
              {t('favorites.emptyTitle')}
            </ThemedText>
            <ThemedText variant="body" tone="textMuted" style={styles.emptyBody}>
              {t('favorites.emptyBody')}
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={quotes}
            keyExtractor={(q) => String(q.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/quote/${item.id}`)}
                onLongPress={() => confirmRemove(item)}
                style={styles.row}>
                <WobblyBorder stroke={colors.faintLine} strokeWidth={1.2} inset={4} />
                <ThemedText variant="quote" numberOfLines={3}>
                  {quoteDisplayText(item, locale)}
                </ThemedText>
                <ThemedText variant="label" tone="textMuted" style={styles.rowAuthor}>
                  {t('quote.authorPrefix')} {localizeAuthor(item.author, locale)}
                </ThemedText>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerUnderline: {
    width: 120,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyTitle: { textAlign: 'center' },
  emptyBody: { textAlign: 'center' },
  list: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  row: {
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  rowAuthor: {
    textAlign: 'right',
  },
});
