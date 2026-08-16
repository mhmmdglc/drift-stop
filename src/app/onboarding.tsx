import { useRouter } from 'expo-router';
import { type ComponentType, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaperBackground } from '@/components/PaperBackground';
import { SketchButton } from '@/components/SketchButton';
import { BellSketch, FlameSketch, HandSketch } from '@/components/SketchOnboardingIcons';
import { SketchTextInput } from '@/components/SketchTextInput';
import { ThemeChips } from '@/components/ThemeChips';
import { ThemedText } from '@/components/ThemedText';
import { Spacing } from '@/constants/layout';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import type { QuoteTag } from '@/types/quote';
import { GOAL_MAX_LENGTH, normalizeGoal } from '@/types/settings';
import { ensurePermissions } from '@/utils/scheduler';
import { setJSON, StorageKeys } from '@/utils/storage';

type IconCmp = ComponentType<{ size?: number; color?: string }>;

const SLIDES: { icon: IconCmp; key: string }[] = [
  { icon: BellSketch, key: 'slide1' },
  { icon: FlameSketch, key: 'slide2' },
  { icon: HandSketch, key: 'slide3' },
];

const STEPS = SLIDES.length + 2; // 3 bilgi + 1 hedef + 1 tercih
const GOAL_STEP = SLIDES.length; // hedef adımı indeksi
const PREF_STEP = SLIDES.length + 1; // son adım indeksi

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { update } = useSettings();
  const [index, setIndex] = useState(0);
  const [themes, setThemes] = useState<QuoteTag[]>([]);
  const [goalText, setGoalText] = useState('');

  const isPreferences = index === PREF_STEP;
  const isGoal = index === GOAL_STEP;

  const toggleTheme = (tag: QuoteTag) =>
    setThemes((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));

  const finish = async () => {
    await ensurePermissions();
    // Temalar + hedef birlikte kaydedilir ve bildirimler yeniden zamanlanır.
    // "Atla" hedef metnini SİLMEZ — yazan kullanıcının girdisi sessizce çöpe gitmesin.
    update({ themes, goal: normalizeGoal(goalText) });
    await setJSON(StorageKeys.onboardingComplete, true);
    router.replace('/');
  };

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe}>
        {/* auth.tsx'teki çözümün aynısı (40ffd94): Android'de `height` olmadan
            klavye açılınca "Devam →" klavyenin arkasında kalıyor ve hedef
            adımından çıkmanın yolu kalmıyor. */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.skip}>
            {!isPreferences && (
              <Pressable onPress={() => setIndex(PREF_STEP)} hitSlop={10}>
                <ThemedText variant="label" tone="textMuted">
                  {t('onboarding.skipButton')}
                </ThemedText>
              </Pressable>
            )}
          </View>

          <View style={styles.body}>
            {isPreferences ? (
              <>
                <ThemedText variant="quoteLarge" style={styles.title}>
                  {t('onboarding.preferences.title')}
                </ThemedText>
                <ThemedText variant="body" tone="textMuted" style={styles.text}>
                  {t('onboarding.preferences.body')}
                </ThemedText>
                <View style={styles.chips}>
                  <ThemeChips selected={themes} onToggle={toggleTheme} />
                </View>
              </>
            ) : isGoal ? (
              <>
                {/* İkon yok: odak nesnesi input'un kendisi ve klavye açıkken
                    dikey alan ikona harcanmaz. */}
                <ThemedText variant="quoteLarge" style={styles.title}>
                  {t('onboarding.goal.title')}
                </ThemedText>
                <ThemedText variant="body" tone="textMuted" style={styles.text}>
                  {t('onboarding.goal.body')}
                </ThemedText>
                <SketchTextInput
                  value={goalText}
                  onChangeText={setGoalText}
                  placeholder={t('onboarding.goal.placeholder')}
                  maxLength={GOAL_MAX_LENGTH}
                  variant="quote"
                  returnKeyType="done"
                  // Yalnızca klavyeyi kapatır — adım geçişi bilinçli "Devam →" dokunuşudur.
                  onSubmitEditing={() => Keyboard.dismiss()}
                  accessibilityLabel={t('onboarding.goal.title')}
                  accessibilityHint={t('onboarding.goal.skipHint')}
                  style={styles.goalInput}
                />
                <ThemedText variant="label" tone="textMuted" style={styles.text}>
                  {t('onboarding.goal.skipHint')}
                </ThemedText>
              </>
            ) : (
              <>
                {(() => {
                  const Icon = SLIDES[index].icon;
                  return <Icon size={88} color={colors.accent} />;
                })()}
                <ThemedText variant="quoteLarge" style={styles.title}>
                  {t(`onboarding.${SLIDES[index].key}.title`)}
                </ThemedText>
                <ThemedText variant="body" tone="textMuted" style={styles.text}>
                  {t(`onboarding.${SLIDES[index].key}.body`)}
                </ThemedText>
              </>
            )}
          </View>

          <View style={styles.dots}>
            {Array.from({ length: STEPS }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === index ? colors.accent : colors.faintLine },
                ]}
              />
            ))}
          </View>

          <View style={styles.footer}>
            {isPreferences ? (
              <SketchButton label={t('onboarding.lastButton')} onPress={finish} />
            ) : (
              <Pressable onPress={() => setIndex((i) => i + 1)} hitSlop={10}>
                <ThemedText variant="heading" tone="accent">
                  {t('onboarding.continueButton')}
                </ThemedText>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  goalInput: { alignSelf: 'stretch' },
  skip: {
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    minHeight: 36,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  title: { textAlign: 'center', alignSelf: 'stretch' },
  text: { textAlign: 'center', alignSelf: 'stretch' },
  chips: { paddingTop: Spacing.md },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
});
