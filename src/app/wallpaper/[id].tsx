import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'phosphor-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaperBackground } from '@/components/PaperBackground';
import { SketchButton } from '@/components/SketchButton';
import { ThemedText } from '@/components/ThemedText';
import { WallpaperCanvas } from '@/components/WallpaperCanvas';
import { WobblyBorder } from '@/components/WobblyBorder';
import { Spacing } from '@/constants/layout';
import { WALLPAPER_ASPECT, WALLPAPER_STYLES } from '@/constants/wallpapers';
import { lookupQuoteAnySource, type QuoteLookup } from '@/data/quotesAnySource';
import { useEntitlement } from '@/hooks/useEntitlement';
import { usePremiumCacheVersion } from '@/hooks/usePremiumCacheVersion';
import { useTheme } from '@/hooks/use-theme';
import { localizeAuthor } from '@/i18n/quoteLocalization';
import { useTranslation } from '@/i18n/useTranslation';
import { quoteDisplayText } from '@/utils/quoteText';
import { captureWallpaper, saveWallpaperToLibrary, shareWallpaper } from '@/utils/wallpaper';

type Busy = 'save' | 'share' | null;

export default function WallpaperScreen() {
  const { colors } = useTheme();
  const { t, locale } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { width: screenWidth } = useWindowDimensions();
  const { entitled } = useEntitlement();
  const premiumCacheVersion = usePremiumCacheVersion();

  const canvasRef = useRef<View>(null);
  const [styleId, setStyleId] = useState(WALLPAPER_STYLES[0].id);
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'accent' | 'fire' } | null>(null);

  const id = Number(params.id);
  const lookup: QuoteLookup = useMemo(
    () => (Number.isFinite(id) ? lookupQuoteAnySource(id, { entitled }) : { status: 'missing' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, entitled, premiumCacheVersion]
  );
  const quote = lookup.status === 'found' ? lookup.quote : undefined;

  const selected = WALLPAPER_STYLES.find((s) => s.id === styleId) ?? WALLPAPER_STYLES[0];

  // Önizleme ekranın yarısı kadar; yanında stil seçici için yer kalıyor.
  const previewWidth = Math.min(screenWidth * 0.56, 260);

  const run = useCallback(
    async (kind: Exclude<Busy, null>) => {
      if (busy) return;
      setBusy(kind);
      setMessage(null);
      try {
        const uri = await captureWallpaper(canvasRef);
        const result =
          kind === 'save' ? await saveWallpaperToLibrary(uri) : await shareWallpaper(uri);

        if (result.ok) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (kind === 'save') setMessage({ text: t('wallpaper.saved'), tone: 'accent' });
        } else {
          setMessage({
            text:
              result.reason === 'permission'
                ? t('wallpaper.errors.permission')
                : t('wallpaper.errors.generic'),
            tone: 'fire',
          });
        }
      } catch {
        setMessage({ text: t('wallpaper.errors.generic'), tone: 'fire' });
      } finally {
        setBusy(null);
      }
    },
    [busy, t]
  );

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

        {!quote ? (
          <View style={styles.body}>
            <ThemedText variant="body" tone="textMuted" style={styles.centered}>
              {lookup.status === 'locked' ? t('quote.lockedTitle') : t('errors.noQuotes')}
            </ThemedText>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            <ThemedText variant="heading">{t('wallpaper.title')}</ThemedText>
            <ThemedText variant="body" tone="textMuted" style={styles.subtitle}>
              {t('wallpaper.subtitle')}
            </ThemedText>

            <View style={styles.previewWrap}>
              <WallpaperCanvas
                ref={canvasRef}
                width={previewWidth}
                style={selected}
                text={quoteDisplayText(quote, locale)}
                author={localizeAuthor(quote.author, locale)}
              />
            </View>

            <ThemedText variant="label" tone="textMuted" style={styles.pickerLabel}>
              {t('wallpaper.pickStyle')}
            </ThemedText>

            <View style={styles.picker}>
              {WALLPAPER_STYLES.map((s) => {
                const active = s.id === selected.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setStyleId(s.id);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={t(`wallpaper.styles.${s.id}`)}
                    style={styles.swatchWrap}>
                    <View
                      style={[
                        styles.swatch,
                        { backgroundColor: s.gradient[0], borderColor: s.accent },
                        active && styles.swatchActive,
                      ]}>
                      <View style={[styles.swatchInk, { backgroundColor: s.gradient[1] }]} />
                    </View>
                    <ThemedText
                      variant="label"
                      tone={active ? 'accent' : 'textMuted'}
                      style={styles.swatchLabel}>
                      {t(`wallpaper.styles.${s.id}`)}
                    </ThemedText>
                    {active && (
                      <View style={styles.swatchRing} pointerEvents="none">
                        <WobblyBorder stroke={colors.accent} strokeWidth={1.4} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {message && (
              <ThemedText variant="body" tone={message.tone} style={styles.centered}>
                {message.text}
              </ThemedText>
            )}

            <View style={styles.actions}>
              <SketchButton
                label={busy === 'save' ? t('common.loading') : t('wallpaper.save')}
                onPress={() => void run('save')}
                disabled={busy !== null}
              />
              <SketchButton
                label={busy === 'share' ? t('common.loading') : t('wallpaper.share')}
                onPress={() => void run('share')}
                disabled={busy !== null}
                textTone="textMuted"
              />
            </View>

            <ThemedText variant="label" tone="textMuted" style={styles.hint}>
              {t('wallpaper.hint')}
            </ThemedText>
          </ScrollView>
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
  body: { flex: 1, justifyContent: 'center' },
  scroll: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  subtitle: { marginTop: -Spacing.xs },
  previewWrap: {
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  pickerLabel: { marginTop: Spacing.sm },
  picker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  swatchWrap: {
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.xs,
    position: 'relative',
  },
  swatch: {
    width: 44,
    height: Math.round(44 * WALLPAPER_ASPECT * 0.42),
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  swatchActive: { borderWidth: 2 },
  swatchInk: { height: '45%', opacity: 0.9 },
  swatchLabel: { textAlign: 'center' },
  swatchRing: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  actions: {
    marginTop: Spacing.md,
    gap: Spacing.md,
    alignItems: 'center',
  },
  centered: { textAlign: 'center' },
  hint: { textAlign: 'center', marginTop: Spacing.sm },
});
