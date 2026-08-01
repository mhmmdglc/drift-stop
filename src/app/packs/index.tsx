import { useRouter } from 'expo-router';
import { ArrowLeft } from 'phosphor-react-native';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
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

/**
 * Listedeki tek bir satır. Paketler ve yazarlar TEK bir sanallaştırılmış listede
 * birleştiriliyor; bölüm başlıkları da satır olarak akıyor.
 *
 * Neden: eskiden bu ekran düz bir `ScrollView` içinde `packs.map` + `authors.map`
 * yapıyordu — canlı veriyle **122 satır (18 paket + 104 yazar)**, her biri kendi
 * `WobblyBorder` SVG'siyle, hepsi aynı anda mount ediliyordu. Ucuz cihazda açılış
 * jankının doğrudan kaynağı; spec'in Faz F "uzun listelerde sanallaştırma" maddesi
 * tam olarak bunu kastediyordu.
 */
type Row =
  | { kind: 'sectionTitle'; key: string; title: string }
  | { kind: 'pack'; key: string; pack: PackWithState }
  | { kind: 'author'; key: string; entry: AuthorWithState };

export default function PacksScreen() {
  const { colors } = useTheme();
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { packs, authors, loading } = usePacks();

  const isEmpty = !loading && packs.length === 0 && authors.length === 0;

  const rows: Row[] = [];
  if (packs.length > 0) {
    rows.push({ kind: 'sectionTitle', key: 's:packs', title: t('packs.collectionsSectionTitle') });
    for (const pack of packs) rows.push({ kind: 'pack', key: `p:${pack.id}`, pack });
  }
  if (authors.length > 0) {
    rows.push({ kind: 'sectionTitle', key: 's:authors', title: t('packs.authorsSectionTitle') });
    for (const a of authors) rows.push({ kind: 'author', key: `a:${a.author}`, entry: a });
  }

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
          <FlatList
            data={rows}
            keyExtractor={(row) => row.key}
            contentContainerStyle={styles.scroll}
            initialNumToRender={12}
            windowSize={7}
            removeClippedSubviews
            renderItem={({ item }) =>
              item.kind === 'sectionTitle' ? (
                <ThemedText variant="label" tone="accent" style={styles.sectionTitle}>
                  {item.title}
                </ThemedText>
              ) : item.kind === 'pack' ? (
                <View style={styles.rowSpacing}>
                  <PackRow pack={item.pack} locale={locale} t={t} />
                </View>
              ) : (
                <View style={styles.rowSpacing}>
                  <AuthorRow entry={item.entry} locale={locale} t={t} />
                </View>
              )
            }
          />
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
  rowSpacing: {
    marginBottom: Spacing.md,
  },
  scroll: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  sectionTitle: {
    letterSpacing: 1,
    marginLeft: Spacing.sm,
    // Bölüm başlıkları artık listenin içinde birer satır; boşluğu eskiden saran
    // `section` View'i veriyordu.
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
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
