import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { PaperBackground } from '@/components/PaperBackground';
import { SketchButton } from '@/components/SketchButton';
import { SketchUnderline } from '@/components/SketchUnderline';
import { ThemedText } from '@/components/ThemedText';
import { Fonts, FontSizes } from '@/constants/fonts';
import { Spacing } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';
import { localizeAuthor, localizeOrigin } from '@/i18n/quoteLocalization';
import { useTranslation } from '@/i18n/useTranslation';
import { logSosOpen, pickSosQuote, type SosLogEntry } from '@/utils/sos';
import { quoteDisplayText } from '@/utils/quoteText';
import { getJSON, setJSON, StorageKeys } from '@/utils/storage';
import type { Quote } from '@/types/quote';

/** Nefes perdesi bütçesi (`w2.2-ux.md` §3.3.a zamanlama tablosu). */
const BREATH_MS = 1500;
/** Perde ↔ söz cross-fade süresi — bütçenin İÇİNDE sayılmaz, Home'un mevcut söz-geçişiyle aynı aralık. */
const CURTAIN_FADE_MS = 300;
const PAUSE_DELAY_MS = 100;
const PAUSE_FADE_MS = 250;

export default function SosScreen() {
  const { colors } = useTheme();
  const { t, locale } = useTranslation();
  const router = useRouter();

  // `step` yalnızca StatusBar override'ını ve perde a11y etiketini yönetir —
  // görsel cross-fade'in kendisi reanimated shared value'larla, React state'inden
  // bağımsız zamanlanıyor (aşağıdaki useEffect).
  const [step, setStep] = useState<'breath' | 'quote'>('breath');
  const [quote, setQuote] = useState<Quote | null>(null);

  const curtainOpacity = useSharedValue(0);
  const pauseOpacity = useSharedValue(0);
  const quoteOpacity = useSharedValue(0);

  // Söz seçimi + log yazımı: perde BAŞLAMADAN ÖNCE (`w2.2-ux.md` §3.6 kararı) —
  // kullanıcı perdeyi bitirmeden çıksa bile SOS açılışı loglanmış olur, bir
  // sonraki SOS'un son-20-dışlaması her koşulda doğru çalışır.
  useEffect(() => {
    let active = true;
    (async () => {
      const log = await getJSON<SosLogEntry[]>(StorageKeys.sosLog, []);
      const picked = pickSosQuote(log);
      void setJSON(StorageKeys.sosLog, logSosOpen(log, picked.id));
      if (active) setQuote(picked);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    curtainOpacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withTiming(1, { duration: BREATH_MS - 200 }),
      withTiming(0, { duration: CURTAIN_FADE_MS })
    );
    pauseOpacity.value = withDelay(
      PAUSE_DELAY_MS,
      withSequence(
        withTiming(1, { duration: PAUSE_FADE_MS }),
        withTiming(1, { duration: BREATH_MS - PAUSE_DELAY_MS - PAUSE_FADE_MS }),
        withTiming(0, { duration: CURTAIN_FADE_MS })
      )
    );
    quoteOpacity.value = withDelay(BREATH_MS, withTiming(1, { duration: CURTAIN_FADE_MS }));

    // `step` state'i JS tarafında ayrı, basit bir zamanlayıcıyla ilerliyor —
    // route bildirim-perdesi bitmeden (geri jesti/donanım tuşuyla) unmount olursa
    // `clearTimeout` bekleyen çağrıyı TAMAMEN iptal eder, unmount-sonrası state
    // güncellemesi hiç tetiklenmez (SplashOverlay'in `runOnJS` + ref-guard deseninden
    // daha basit ama aynı güvenliği sağlayan bir alternatif).
    const timer = setTimeout(() => setStep('quote'), BREATH_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const curtainStyle = useAnimatedStyle(() => ({ opacity: curtainOpacity.value }));
  const pauseStyle = useAnimatedStyle(() => ({ opacity: pauseOpacity.value }));
  const quoteStyle = useAnimatedStyle(() => ({ opacity: quoteOpacity.value }));

  const onContinue = useCallback(() => {
    router.back();
  }, [router]);

  const text = quote ? quoteDisplayText(quote, locale) : '';

  return (
    <View style={styles.root}>
      <PaperBackground>
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
          {quote && (
            <Animated.View style={[styles.quoteScreen, quoteStyle]}>
              <View style={styles.centerBlock}>
                <ThemedText variant="quoteLarge" style={styles.quoteText}>
                  {text}
                </ThemedText>
                <View style={styles.authorBlock}>
                  <ThemedText variant="author" tone="textMuted">
                    {t('quote.authorPrefix')} {localizeAuthor(quote.author, locale)}
                  </ThemedText>
                  <View style={styles.underline}>
                    <SketchUnderline />
                  </View>
                  <ThemedText variant="label" tone="textMuted">
                    {quote.originEmoji} {localizeOrigin(quote.origin, locale)}{' '}
                    {t('quote.originSeparator')} {t(`quote.eras.${quote.era}`)}
                  </ThemedText>
                </View>
              </View>
              <SketchButton
                size="large"
                label={t('sos.continueButton')}
                textTone="accent"
                onPress={onContinue}
              />
            </Animated.View>
          )}
        </SafeAreaView>
      </PaperBackground>

      <Animated.View
        style={[StyleSheet.absoluteFill, styles.curtain, curtainStyle]}
        pointerEvents="none"
        // Perde bitince (step → 'quote') a11y ağacından da çıkar — aksi halde
        // görünmez ama hâlâ odaklanabilir bu katman, VoiceOver/TalkBack'in söz
        // metnine/butona ulaşmasını bir kaydırma daha geciktirirdi.
        accessible={step === 'breath'}
        accessibilityElementsHidden={step !== 'breath'}
        importantForAccessibility={step === 'breath' ? 'yes' : 'no-hide-descendants'}
        accessibilityLabel={t('sos.title')}>
        <Animated.Text
          style={[styles.pauseLine, { color: colors.accent, fontFamily: Fonts.display }, pauseStyle]}>
          {t('sos.pauseLine')}
        </Animated.Text>
      </Animated.View>

      {step === 'breath' && <StatusBar style="light" />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  curtain: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseLine: {
    fontSize: FontSizes.title + 8,
    letterSpacing: 2,
  },
  quoteScreen: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  quoteText: {
    textAlign: 'center',
  },
  authorBlock: {
    gap: Spacing.xs,
    alignItems: 'center',
  },
  underline: {
    width: 140,
  },
});
