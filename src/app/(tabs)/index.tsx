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
import { ThemedText } from '@/components/ThemedText';
import { INTERSTITIAL_EVERY } from '@/constants/adUnits';
import { Spacing } from '@/constants/layout';
import { useFavorites } from '@/hooks/useFavorites';
import { useHistory } from '@/hooks/useHistory';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import { showInterstitialIfReady } from '@/utils/ads';
import { shareQuote } from '@/utils/share';
import { updateWidgetWithQuote } from '@/widgets/updateWidget';

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
    if (navCount.current % INTERSTITIAL_EVERY === 0) {
      showInterstitialIfReady();
    }
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
          <ThemedText variant="heading" tone="text">
            {t('app.name')}
          </ThemedText>
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={12}
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
              />
            )}
          </Animated.View>
        </GestureDetector>

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
});
