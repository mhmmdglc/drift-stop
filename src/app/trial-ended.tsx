import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaperBackground } from '@/components/PaperBackground';
import { SketchButton } from '@/components/SketchButton';
import { ThemedText } from '@/components/ThemedText';
import { WobblyBorder } from '@/components/WobblyBorder';
import { Spacing } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';
import { useTrial } from '@/hooks/useTrial';
import { useTranslation } from '@/i18n/useTranslation';

/**
 * Deneme bitiş ekranı — 8. günde BİR KEZ gösterilir (spec §5.3).
 *
 * "Bir kez" kararı `useTrial` içindeki `trialEndedShown` bayrağıyla veriliyor ve
 * işaret BURADA, ekran gerçekten mount olduğunda atılıyor. Önce `useTrialLifecycle`
 * içinde, yönlendirmeden hemen önce atılıyordu; emülatörde görüldü ki açılış sırasında
 * yapılan `push` sessizce düşebiliyor — işaret atılmış ama ekran hiç görünmemiş oluyordu
 * ve bir daha da açılmıyordu. Artık navigasyon düşerse işaret de atılmaz.
 *
 * Geri hareketi bilinçli olarak serbest: bu bir satış duvarı değil, bir bilgilendirme.
 * Kullanıcıyı hapsetmek mağaza politikası açısından da risklidir.
 */
export default function TrialEndedScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { acknowledgeEnded } = useTrial();

  // Ekran görüldü → bir daha açılmayacak.
  useEffect(() => {
    acknowledgeEnded();
  }, [acknowledgeEnded]);

  const close = () => {
    // `replace` DEĞİL `dismissTo`/`back` değil: bu ekran normal bir push olarak
    // açıldı, geri gitmek kullanıcıyı bıraktığı sekmeye döndürür.
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText variant="heading">{t('trial.ended.title')}</ThemedText>

          <View style={styles.card}>
            <WobblyBorder stroke={colors.accent} strokeWidth={1.4} inset={2} />
            <ThemedText variant="body" tone="textMuted">
              {t('trial.ended.changes')}
            </ThemedText>
          </View>

          <ThemedText variant="body">{t('trial.ended.invite')}</ThemedText>
          <ThemedText variant="body" tone="accent" style={styles.emphasis}>
            {t('trial.ended.inviteEmphasis')}
          </ThemedText>

          <ThemedText variant="body" tone="textMuted">
            {t('trial.ended.reassure')}
          </ThemedText>

          <SketchButton
            label={t('trial.ended.primaryCta')}
            onPress={() => router.replace('/paywall')}
            style={styles.primary}
          />

          <Pressable onPress={close} accessibilityRole="button" hitSlop={12} style={styles.secondary}>
            <ThemedText variant="label" tone="textMuted">
              {t('trial.ended.secondaryCta')}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  card: {
    position: 'relative',
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  emphasis: {
    marginTop: -Spacing.xs,
  },
  primary: {
    marginTop: Spacing.lg,
    alignSelf: 'center',
  },
  secondary: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
  },
});
