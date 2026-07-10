import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'phosphor-react-native';
import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaperBackground } from '@/components/PaperBackground';
import { QuoteCard } from '@/components/QuoteCard';
import { ThemedText } from '@/components/ThemedText';
import { Spacing } from '@/constants/layout';
import { getQuoteByIdAnySource } from '@/data/quotesAnySource';
import { useFavorites } from '@/hooks/useFavorites';
import { useHistory } from '@/hooks/useHistory';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import { shareQuote } from '@/utils/share';

export default function QuoteDetailScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const favorites = useFavorites();
  const { record } = useHistory();

  const id = Number(params.id);
  const quote = Number.isFinite(id) ? getQuoteByIdAnySource(id) : undefined;

  // Bildirimden/widget'tan açılan sözü geçmişe ekle.
  // Premium paket sözleri hariç: Home'un geçmişi sadece statik 1000 sözden id çözebiliyor
  // (bkz. useHistory + getQuoteById) — premium id'yi geçmişe yazmak Home'da boş karta yol açar.
  useEffect(() => {
    if (quote && !quote.isPremium) record(quote.id);
  }, [quote?.id, quote?.isPremium, record]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.back}>
          <ArrowLeft size={22} weight="thin" color={colors.textMuted} />
          <ThemedText variant="label" tone="textMuted">
            {t('common.back')}
          </ThemedText>
        </Pressable>

        <View style={styles.body}>
          {quote ? (
            <QuoteCard
              quote={quote}
              isFavorite={favorites.isFavorite(quote.id)}
              onToggleFavorite={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                favorites.toggle(quote.id);
              }}
              onShare={() => void shareQuote(quote)}
            />
          ) : (
            <ThemedText variant="body" tone="textMuted" style={styles.notFound}>
              {t('errors.noQuotes')}
            </ThemedText>
          )}
        </View>
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
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  notFound: {
    textAlign: 'center',
  },
});
