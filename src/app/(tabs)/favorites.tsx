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
import { lookupQuoteAnySource } from '@/data/quotesAnySource';
import { useFavorites } from '@/hooks/useFavorites';
import { usePremiumCacheVersion } from '@/hooks/usePremiumCacheVersion';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import type { Quote } from '@/types/quote';

/**
 * Favori bir id üç durumdan birinde olabilir: çözüldü (`quote`), premium olduğu
 * için kilitli (`quote = null`), ya da entitlement henüz belli olmadığı için
 * kararsız (`pending`) — kararsızı kilitli göstermek Pro kullanıcıyı yanıltır.
 */
type FavoriteEntry = { id: number; quote: Quote | null; pending: boolean };

export default function FavoritesScreen() {
  const { colors } = useTheme();
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { ids, remove } = useFavorites();
  const { entitled, entitlementKnown } = useEntitlement();
  // Cache mutasyonu (temizlik/geri yükleme) React ağacının dışında oluyor; bu sayaç
  // olmadan satın alma sonrası satırlar geldiğinde aşağıdaki memo bir daha
  // hesaplanmaz ve ödeme yapan kullanıcı kilidi görmeye devam eder. Favoriler
  // mount kalan bir sekme olduğu için sekme değiştirmek de kurtarmıyor.
  const premiumCacheVersion = usePremiumCacheVersion();

  // Premium bir favori, abonelik bitince yerel cache'ten silinir (bkz.
  // services/premiumCacheGuard.ts). Kaydı sessizce listeden düşürmek "favorim
  // kayboldu" hissi verirdi; bunun yerine kilitli satır olarak durur —
  // dokununca /quote/[id] kilit ekranını ve Pro çağrısını gösterir.
  // Ücretsiz sözler bu akıştan hiç etkilenmez (statik dizide çözülürler).
  const entries = useMemo<FavoriteEntry[]>(
    () =>
      ids.reduce<FavoriteEntry[]>((acc, id) => {
        const result = lookupQuoteAnySource(id, { entitled });
        if (result.status === 'found') acc.push({ id, quote: result.quote, pending: false });
        // Yetki henüz BİLİNMİYORSA (`entitlementKnown` false) bu satır gerçekten
        // kilitli mi, yoksa hak henüz gelmedi mi ayırt edilemez → kilit yerine
        // "yükleniyor" göster (quote/[id] ile aynı davranış).
        else if (result.status === 'locked')
          acc.push({ id, quote: null, pending: !entitlementKnown });
        // 'missing' → hiçbir kaynakta yok; gösterilecek bir şey yok.
        return acc;
      }, []),
    // `premiumCacheVersion` sadece yeniden-okuma tetiklemek için bağımlılık;
    // değeri kullanılmıyor (aynı kalıp: usePacks.tsx:42).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ids, entitled, entitlementKnown, premiumCacheVersion]
  );

  const confirmRemove = (id: number) => {
    Alert.alert(t('favorites.screenTitle'), t('favorites.removeConfirm'), [
      { text: t('favorites.removeNo'), style: 'cancel' },
      { text: t('favorites.removeYes'), style: 'destructive', onPress: () => remove(id) },
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

        {entries.length === 0 ? (
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
            data={entries}
            keyExtractor={(entry) => String(entry.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/quote/${item.id}`)}
                onLongPress={() => confirmRemove(item.id)}
                accessibilityRole="button"
                accessibilityLabel={
                  item.quote
                    ? quoteDisplayText(item.quote, locale)
                    : item.pending
                      ? t('common.loading')
                      : t('favorites.lockedPremium')
                }
                style={styles.row}>
                <WobblyBorder stroke={colors.faintLine} strokeWidth={1.2} inset={4} />
                {item.quote ? (
                  <>
                    <ThemedText variant="quote" numberOfLines={3}>
                      {quoteDisplayText(item.quote, locale)}
                    </ThemedText>
                    <ThemedText variant="label" tone="textMuted" style={styles.rowAuthor}>
                      {t('quote.authorPrefix')} {localizeAuthor(item.quote.author, locale)}
                    </ThemedText>
                  </>
                ) : item.pending ? (
                  <ThemedText variant="quote" tone="textMuted" numberOfLines={2}>
                    {t('common.loading')}
                  </ThemedText>
                ) : (
                  <ThemedText variant="quote" tone="textMuted" numberOfLines={2}>
                    🔒 {t('favorites.lockedPremium')}
                  </ThemedText>
                )}
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
