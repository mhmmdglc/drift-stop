import { useRouter } from 'expo-router';
import { ArrowLeft } from 'phosphor-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Doodle } from '@/components/Doodle';
import { PaperBackground } from '@/components/PaperBackground';
import { SketchUnderline } from '@/components/SketchUnderline';
import { ThemedText } from '@/components/ThemedText';
import { WobblyBorder } from '@/components/WobblyBorder';
import { Spacing } from '@/constants/layout';
import { usePacks, type AuthorWithState, type PackWithState } from '@/hooks/usePacks';
import { useTheme } from '@/hooks/use-theme';
import { localizeAuthor } from '@/i18n/quoteLocalization';
import { useTranslation } from '@/i18n/useTranslation';
import { localizedPackField } from '@/types/quotePack';

export default function PacksScreen() {
  const { colors } = useTheme();
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { packs, authors, loading } = usePacks();

  const isEmpty = !loading && packs.length === 0 && authors.length === 0;

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <ArrowLeft size={22} weight="thin" color={colors.textMuted} />
          <ThemedText variant="label" tone="textMuted">
            {t('common.back')}
          </ThemedText>
        </Pressable>

        <View style={styles.header}>
          <ThemedText variant="heading">{t('packs.screenTitle')}</ThemedText>
          <View style={styles.headerUnderline}>
            <SketchUnderline />
          </View>
          <ThemedText variant="body" tone="textMuted" style={styles.subtitle}>
            {t('packs.subtitle')}
          </ThemedText>
        </View>

        {isEmpty ? (
          <View style={styles.empty}>
            <ThemedText variant="quote" tone="textMuted" style={styles.emptyTitle}>
              {t('packs.emptyTitle')}
            </ThemedText>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            {packs.length > 0 && (
              <View style={styles.section}>
                <ThemedText variant="label" tone="accent" style={styles.sectionTitle}>
                  {t('packs.collectionsSectionTitle')}
                </ThemedText>
                <View style={styles.rows}>
                  {packs.map((pack) => (
                    <PackRow key={pack.id} pack={pack} locale={locale} t={t} />
                  ))}
                </View>
              </View>
            )}

            {authors.length > 0 && (
              <View style={styles.section}>
                <ThemedText variant="label" tone="accent" style={styles.sectionTitle}>
                  {t('packs.authorsSectionTitle')}
                </ThemedText>
                <View style={styles.rows}>
                  {authors.map((a) => (
                    <AuthorRow key={a.author} entry={a} locale={locale} t={t} />
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </PaperBackground>
  );
}

function PackRow({
  pack,
  locale,
  t,
}: {
  pack: PackWithState;
  locale: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const name = localizedPackField(pack.name, locale);
  const description = localizedPackField(pack.description, locale);

  return (
    <Pressable onPress={() => router.push(`/packs/${pack.id}`)} style={styles.row}>
      <WobblyBorder stroke={colors.faintLine} strokeWidth={1.2} inset={4} />
      <View style={styles.rowTop}>
        <ThemedText variant="quote" numberOfLines={1} style={styles.rowTitle}>
          {name}
        </ThemedText>
        {pack.locked && (
          <ThemedText variant="label" tone="fire">
            🔒 {t('packs.lockedBadge')}
          </ThemedText>
        )}
      </View>
      {description ? (
        <ThemedText variant="body" tone="textMuted" numberOfLines={2}>
          {description}
        </ThemedText>
      ) : null}
      <View style={styles.rowFooter}>
        <Doodle kind="star" size={12} color={colors.accent} opacity={0.4} />
        <ThemedText variant="label" tone="textMuted">
          {t('packs.quoteCount', { count: pack.quoteCount })}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function AuthorRow({
  entry,
  locale,
  t,
}: {
  entry: AuthorWithState;
  locale: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/packs/author/${encodeURIComponent(entry.author)}`)}
      style={styles.row}>
      <WobblyBorder stroke={colors.faintLine} strokeWidth={1.2} inset={4} />
      <View style={styles.rowTop}>
        <ThemedText variant="quote" numberOfLines={1} style={styles.rowTitle}>
          {localizeAuthor(entry.author, locale)}
        </ThemedText>
        {entry.locked && (
          <ThemedText variant="label" tone="fire">
            🔒 {t('packs.lockedBadge')}
          </ThemedText>
        )}
      </View>
      <View style={styles.rowFooter}>
        <Doodle kind="star" size={12} color={colors.accent} opacity={0.4} />
        <ThemedText variant="label" tone="textMuted">
          {t('packs.quoteCount', { count: entry.quoteCount })}
        </ThemedText>
      </View>
    </Pressable>
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
  subtitle: {
    marginTop: Spacing.sm,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  scroll: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    letterSpacing: 1,
    marginLeft: Spacing.sm,
  },
  rows: {
    gap: Spacing.md,
  },
  row: {
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  rowTitle: {
    flexShrink: 1,
  },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
});
