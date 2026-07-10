import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'phosphor-react-native';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaperBackground } from '@/components/PaperBackground';
import { SketchButton } from '@/components/SketchButton';
import { SketchUnderline } from '@/components/SketchUnderline';
import { ThemedText } from '@/components/ThemedText';
import { WobblyBorder } from '@/components/WobblyBorder';
import { Spacing } from '@/constants/layout';
import { getAuthorQuotes } from '@/data/quotesAnySource';
import { usePacks } from '@/hooks/usePacks';
import { useTheme } from '@/hooks/use-theme';
import { localizeAuthor } from '@/i18n/quoteLocalization';
import { useTranslation } from '@/i18n/useTranslation';
import { quoteDisplayText } from '@/utils/quoteText';
import type { Quote } from '@/types/quote';

export default function AuthorPackScreen() {
  const { colors } = useTheme();
  const { t, locale } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ name: string }>();
  const author = decodeURIComponent(params.name ?? '');
  const { authors, loading } = usePacks();

  const entry = authors.find((a) => a.author === author);
  const quotes = useMemo<Quote[]>(
    () => (entry && !entry.locked ? getAuthorQuotes(author) : []),
    [entry, author]
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/packs'));

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.back}>
          <ArrowLeft size={22} weight="thin" color={colors.textMuted} />
          <ThemedText variant="label" tone="textMuted">
            {t('common.back')}
          </ThemedText>
        </Pressable>

        {!entry ? (
          <View style={styles.empty}>
            <ThemedText variant="body" tone="textMuted">
              {loading ? t('common.loading') : t('errors.noQuotes')}
            </ThemedText>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <ThemedText variant="heading">{localizeAuthor(entry.author, locale)}</ThemedText>
              <View style={styles.headerUnderline}>
                <SketchUnderline />
              </View>
            </View>

            {entry.locked ? (
              <View style={styles.locked}>
                <ThemedText variant="quote" tone="textMuted" style={styles.lockedTitle}>
                  🔒 {t('packs.lockedTitle')}
                </ThemedText>
                <ThemedText variant="body" tone="textMuted" style={styles.lockedBody}>
                  {t('packs.lockedBody')}
                </ThemedText>
                <SketchButton
                  label={t('packs.unlockCta')}
                  onPress={() => router.push('/paywall')}
                  style={styles.unlockBtn}
                />
              </View>
            ) : quotes.length === 0 ? (
              <View style={styles.empty}>
                <ThemedText variant="body" tone="textMuted" style={styles.emptyText}>
                  {t('packs.syncingBody')}
                </ThemedText>
              </View>
            ) : (
              <FlatList
                data={quotes}
                keyExtractor={(q) => String(q.id)}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                  <Pressable onPress={() => router.push(`/quote/${item.id}`)} style={styles.row}>
                    <WobblyBorder stroke={colors.faintLine} strokeWidth={1.2} inset={4} />
                    <ThemedText variant="quote" numberOfLines={3}>
                      {quoteDisplayText(item, locale)}
                    </ThemedText>
                  </Pressable>
                )}
              />
            )}
          </>
        )}
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  header: {
    paddingHorizontal: Spacing.lg,
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
  },
  emptyText: {
    textAlign: 'center',
  },
  locked: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  lockedTitle: {
    textAlign: 'center',
  },
  lockedBody: {
    textAlign: 'center',
  },
  unlockBtn: {
    marginTop: Spacing.md,
  },
  list: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  row: {
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
});
