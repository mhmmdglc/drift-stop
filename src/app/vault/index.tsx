import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaperBackground } from '@/components/PaperBackground';
import { SketchButton } from '@/components/SketchButton';
import { SketchUnderline } from '@/components/SketchUnderline';
import { ThemedText } from '@/components/ThemedText';
import { WobblyBorder } from '@/components/WobblyBorder';
import { Spacing } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import { dateKey } from '@/utils/timeUtils';
import { deleteMessage, listMessages, type VaultMessage } from '@/utils/vault';

/** Teslim tarihini "3 Mayıs 2026" biçiminde okunur yapar — `scheduler.ts#vaultDateLabel`
 * ile AYNI Hermes/ICU fallback gerekçesi (bazı motorlarda tam ICU verisi olmayabilir). */
function formatDeliveredDate(at: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(at));
  } catch {
    return dateKey(new Date(at));
  }
}

/**
 * `packs/index.tsx`'in `Row` union + sanallaştırma deseninin BİREBİR kopyası
 * (`w2.1-ux.md` §10) — Pro kullanıcı onlarca mesaj biriktirebilir.
 */
type Row =
  | { kind: 'sectionTitle'; key: string; title: string }
  | { kind: 'sleeping'; key: string; message: VaultMessage }
  | { kind: 'delivered'; key: string; message: VaultMessage };

export default function VaultListScreen() {
  const { colors } = useTheme();
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [messages, setMessages] = useState<VaultMessage[] | null>(null);

  // Editörden/detaydan dönüşte (add/delete/rearm) veri diskten tazelenir —
  // `useReckoning`'in `useFocusEffect` deseniyle AYNI, kasa için ayrı bir
  // provider/hook gerekmez (tek tüketici).
  const reload = useCallback(() => {
    let active = true;
    listMessages().then((all) => {
      if (active) setMessages(all);
    });
    return () => {
      active = false;
    };
  }, []);
  useFocusEffect(reload);

  const confirmRemove = (id: number) => {
    Alert.alert(t('vault.deleteConfirmTitle'), t('vault.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('vault.delete'),
        style: 'destructive',
        onPress: () => {
          void deleteMessage(id);
          setMessages((prev) => (prev ? prev.filter((m) => m.id !== id) : prev));
        },
      },
    ]);
  };

  const loading = messages === null;
  const all = messages ?? [];
  // Uykuda: en yeni uykuya giren (rearm de sayılır) önce. Teslim edildi: en son
  // teslim edilen önce — `favorites`/`useHistory` ile aynı "en yeni önce" konvansiyonu.
  const sleeping = all
    .filter((m) => m.deliveredAt === null)
    .sort((a, b) => (b.rearmedAt ?? b.createdAt) - (a.rearmedAt ?? a.createdAt));
  const delivered = all
    .filter((m) => m.deliveredAt !== null)
    .sort((a, b) => (b.deliveredAt as number) - (a.deliveredAt as number));

  const rows: Row[] = [];
  if (sleeping.length > 0) {
    rows.push({ kind: 'sectionTitle', key: 's:sleeping', title: t('vault.sleeping') });
    for (const m of sleeping) rows.push({ kind: 'sleeping', key: `s:${m.id}`, message: m });
  }
  if (delivered.length > 0) {
    rows.push({
      kind: 'sectionTitle',
      key: 's:delivered',
      title: t('vault.deliveredSectionTitle'),
    });
    for (const m of delivered) rows.push({ kind: 'delivered', key: `d:${m.id}`, message: m });
  }

  const isEmpty = !loading && rows.length === 0;

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
          <ThemedText variant="heading">{t('vault.title')}</ThemedText>
          <View style={styles.headerUnderline}>
            <SketchUnderline />
          </View>
          <ThemedText variant="body" tone="textMuted" style={styles.subtitle}>
            {t('vault.subtitle')}
          </ThemedText>
        </View>

        {/* "+" JSX'te dekoratif, çeviri metni temiz kalır (`favorites`/`packs`'taki
            🔒 desteninin aynı ilkesi — bkz. w2.1-ux.md §6 notu). */}
        <SketchButton
          label={`+ ${t('vault.addButton')}`}
          onPress={() => router.push('/vault/new')}
          style={styles.addButton}
        />

        {loading ? (
          <ThemedText variant="body" tone="textMuted" style={styles.emptyTitle}>
            {t('common.loading')}
          </ThemedText>
        ) : isEmpty ? (
          <View style={styles.empty}>
            <ThemedText variant="quote" tone="textMuted" style={styles.emptyTitle}>
              {t('vault.emptyTitle')}
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
              ) : item.kind === 'sleeping' ? (
                <View style={styles.rowSpacing}>
                  {/* İçerik ASLA gösterilmez — sürpriz kendine karşı da korunur
                      (roadmap kararı). `disabled` native prop KULLANILMAZ: uzun
                      basışla silme yine de çalışabilsin diye (roadmap: "bir mesajı
                      hiç teslim olmadan da silebilmek gerekir") — a11y niyeti
                      `accessibilityState.disabled` ile taşınır. */}
                  <Pressable
                    onLongPress={() => confirmRemove(item.message.id)}
                    accessibilityRole="button"
                    accessibilityLabel={t('vault.a11ySleeping')}
                    accessibilityState={{ disabled: true }}
                    style={styles.row}>
                    <WobblyBorder stroke={colors.faintLine} strokeWidth={1.2} inset={4} dashed />
                    <ThemedText variant="quote" tone="textMuted">
                      🔒 {t('vault.sleeping')}
                    </ThemedText>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.rowSpacing}>
                  <Pressable
                    onPress={() => router.push(`/vault/${item.message.id}`)}
                    onLongPress={() => confirmRemove(item.message.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.message.text} ${t('vault.deliveredAt', {
                      date: formatDeliveredDate(item.message.deliveredAt as number, locale),
                    })}`}
                    style={styles.row}>
                    <WobblyBorder stroke={colors.faintLine} strokeWidth={1.2} inset={4} />
                    <ThemedText variant="quote" numberOfLines={2}>
                      {item.message.text}
                    </ThemedText>
                    <ThemedText variant="label" tone="textMuted" style={styles.rowFooter}>
                      {t('vault.deliveredAt', {
                        date: formatDeliveredDate(item.message.deliveredAt as number, locale),
                      })}
                    </ThemedText>
                  </Pressable>
                </View>
              )
            }
          />
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
  subtitle: {
    marginTop: Spacing.sm,
  },
  addButton: {
    alignSelf: 'center',
    marginBottom: Spacing.md,
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
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  row: {
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  rowFooter: {
    textAlign: 'right',
  },
});
