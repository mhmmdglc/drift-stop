import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Gear } from 'phosphor-react-native';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/AdBanner';
import { PaperBackground } from '@/components/PaperBackground';
import { QuoteCard } from '@/components/QuoteCard';
import { SketchButton } from '@/components/SketchButton';
import { SketchHandStop } from '@/components/SketchIcons';
import { FlameSketch } from '@/components/SketchOnboardingIcons';
import { ThemedText } from '@/components/ThemedText';
import { WobblyBorder } from '@/components/WobblyBorder';
import { INTERSTITIAL_EVERY } from '@/constants/adUnits';
import { Spacing } from '@/constants/layout';
import { useFavorites } from '@/hooks/useFavorites';
import { useHistory } from '@/hooks/useHistory';
import { useReckoning } from '@/hooks/useReckoning';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import { showInterstitialIfReady } from '@/utils/ads';
import { shareQuote } from '@/utils/share';
import { updateWidgetWithQuote } from '@/widgets/updateWidget';

/**
 * Kartın hemen altındaki kompakt hesaplaşma şeridi (`w1.3-ux.md` §2). Log boşsa
 * ya da özellik kapalıysa TAMAMEN render edilmez (boşluk bırakmaz) — ilk cevaba
 * kadar Home kalabalıklaşmasın.
 */
function ReckoningStrip() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { settings } = useSettings();
  const { loaded, streak, week, answeredToday, hasAnyAnswer } = useReckoning();

  if (!settings.reckoningEnabled || !loaded || !hasAnyAnswer) return null;

  const accessibilityLabel = answeredToday
    ? t('home.reckoningA11yAnswered', { streak, resisted: week.resisted, total: week.total })
    : t('home.reckoningA11yPending');

  return (
    <Pressable
      onPress={() => router.push('/reckoning')}
      style={styles.reckoningStrip}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}>
      <WobblyBorder stroke={colors.faintLine} strokeWidth={1.2} inset={3} doubleStroke={false} />
      {answeredToday ? (
        <>
          <FlameSketch size={20} color={streak > 0 ? colors.fire : colors.textMuted} />
          <ThemedText variant="body" tone={streak > 0 ? 'fire' : 'textMuted'}>
            {streak}
          </ThemedText>
          <ThemedText variant="label" tone="textMuted" style={styles.reckoningWeek}>
            {t('home.reckoningWeek', { resisted: week.resisted, total: week.total })}
          </ThemedText>
        </>
      ) : (
        <>
          <FlameSketch size={20} color={colors.accent} />
          <ThemedText variant="body" tone="accent" style={styles.reckoningWeek}>
            {t('home.reckoningWaiting')}
          </ThemedText>
        </>
      )}
      <ThemedText variant="body" tone="textMuted">
        ›
      </ThemedText>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { quote, goOlder, randomFromHistory, canOlder, count } = useHistory();
  const favorites = useFavorites();

  const opacity = useSharedValue(1);
  const ty = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  // Söz değişince içeri sürüklenerek belir (fade + drift) + widget'ı güncelle
  useEffect(() => {
    opacity.value = 0;
    ty.value = 8;
    opacity.value = withTiming(1, { duration: 250 });
    ty.value = withTiming(0, { duration: 250 });
    if (quote) void updateWidgetWithQuote(quote.id);
  }, [quote?.id, opacity, ty]);

  const change = useCallback(
    (fn: () => void) => {
      opacity.value = withTiming(0, { duration: 120 }, (finished) => {
        if (finished) runOnJS(fn)();
      });
      ty.value = withTiming(-8, { duration: 120 });
    },
    [opacity, ty]
  );

  const navCount = useRef(0);
  const bumpAd = useCallback(() => {
    navCount.current += 1;
    if (navCount.current < INTERSTITIAL_EVERY) return;
    // Eşik `% INTERSTITIAL_EVERY` ile kontrol ediliyordu: zaman kapısı tam o
    // kaydırmada bloklarsa bir sonraki şans 12 kaydırma sonraydı. Artık eşiğe
    // gelindikten sonra HER kaydırmada denenir ve sayaç yalnızca reklam
    // GÖSTERİLDİĞİNDE sıfırlanır.
    if (showInterstitialIfReady()) navCount.current = 0;
  }, []);

  const onRandom = useCallback(() => {
    if (count <= 1) return;
    void Haptics.selectionAsync();
    change(randomFromHistory);
    bumpAd();
  }, [count, change, randomFromHistory, bumpAd]);

  const onOlder = useCallback(() => {
    if (!canOlder) return;
    change(goOlder);
    bumpAd();
  }, [canOlder, change, goOlder, bumpAd]);

  const pan = Gesture.Pan().onEnd((e) => {
    'worklet';
    if (e.translationX < -40) {
      runOnJS(onRandom)();
    } else if (e.translationX > 40) {
      runOnJS(onOlder)();
    }
  });

  const toggleFavorite = useCallback(() => {
    if (!quote) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    favorites.toggle(quote.id);
  }, [favorites, quote]);

  const onShare = useCallback(() => {
    if (quote) void shareQuote(quote);
  }, [quote]);

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          {/* Header'ın YENİ İLK çocuğu: dişliyle eşit genişlikte bir eleman
              `space-between`'i başlığı otomatik ortalıyor — `styles.header`
              DEĞİŞMEDEN "dişlinin karşısı" talimatı karşılanıyor (`w2.2-ux.md` §2.1). */}
          <Pressable
            onPress={() => router.push('/sos')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('home.sosLabel')}>
            <SketchHandStop size={22} color={colors.fire} />
          </Pressable>
          <ThemedText variant="heading" tone="text">
            {t('app.name')}
          </ThemedText>
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('settings.screenTitle')}>
            <Gear size={24} weight="thin" color={colors.textMuted} />
          </Pressable>
        </View>

        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.cardWrap, animStyle]}>
            {quote && (
              <QuoteCard
                quote={quote}
                isFavorite={favorites.isFavorite(quote.id)}
                onToggleFavorite={toggleFavorite}
                onShare={onShare}
                onMakeWallpaper={() => router.push(`/wallpaper/${quote.id}`)}
              />
            )}
          </Animated.View>
        </GestureDetector>

        <ReckoningStrip />

        {/* "Sonraki" yok: yeni söz zamanı gelince bildirimle gelir */}
        <ThemedText variant="body" tone="textMuted" style={styles.patience}>
          {t('home.patience')}
        </ThemedText>

        <View style={styles.nav}>
          <SketchButton
            label={`← ${t('home.prevQuote')}`}
            onPress={onOlder}
            disabled={!canOlder}
            textTone="textMuted"
          />
          <SketchButton
            label={`${t('home.randomFromHistory')}  ↻`}
            onPress={onRandom}
            disabled={count <= 1}
          />
        </View>

        <AdBanner />
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  cardWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  patience: {
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  reckoningStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 48,
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  reckoningWeek: {
    flex: 1,
  },
});
