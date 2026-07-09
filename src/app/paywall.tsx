import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { PACKAGE_TYPE, type PurchasesPackage } from 'react-native-purchases';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaperBackground } from '@/components/PaperBackground';
import { SketchButton } from '@/components/SketchButton';
import { ThemedText } from '@/components/ThemedText';
import { WobblyBorder } from '@/components/WobblyBorder';
import { Spacing } from '@/constants/layout';
import { usePurchases } from '@/hooks/usePurchases';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';

function packageLabel(pkg: PurchasesPackage, t: (key: string) => string): { label: string; hint: string | null } {
  switch (pkg.packageType) {
    case PACKAGE_TYPE.LIFETIME:
      return { label: t('paywall.packages.lifetimeLabel'), hint: t('paywall.packages.lifetimeHint') };
    case PACKAGE_TYPE.ANNUAL:
      return { label: t('paywall.packages.annualLabel'), hint: t('paywall.packages.annualHint') };
    case PACKAGE_TYPE.MONTHLY:
      return { label: t('paywall.packages.monthlyLabel'), hint: null };
    default:
      return { label: pkg.product.title, hint: null };
  }
}

export default function PaywallScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { configured, loading, isPro, isAdsRemoved, offering, purchasePackage, restorePurchases } = usePurchases();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'accent' | 'fire' } | null>(null);

  const buy = async (pkg: PurchasesPackage) => {
    setBusyId(pkg.identifier);
    setMessage(null);
    const result = await purchasePackage(pkg);
    setBusyId(null);
    if (result.cancelled) return;
    if (result.error) {
      setMessage({ text: t('paywall.errors.generic'), tone: 'fire' });
      return;
    }
    setMessage({ text: t('paywall.purchaseSuccess'), tone: 'accent' });
  };

  const restore = async () => {
    setRestoring(true);
    setMessage(null);
    const result = await restorePurchases();
    setRestoring(false);
    if (result.error) {
      setMessage({ text: t('paywall.errors.generic'), tone: 'fire' });
      return;
    }
    setMessage({ text: t('paywall.restoreSuccess'), tone: 'accent' });
  };

  const packages = offering?.availablePackages ?? [];

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText variant="label" tone="textMuted">
              {t('paywall.skip')}
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.content}>
          <ThemedText variant="heading">{t('paywall.title')}</ThemedText>
          <ThemedText variant="body" tone="textMuted" style={styles.subtitle}>
            {t('paywall.subtitle')}
          </ThemedText>
          <ThemedText variant="label" tone="textMuted">
            {t('paywall.packages.proFeatures')}
          </ThemedText>

          {isPro ? (
            <ThemedText variant="body" tone="accent" style={styles.stateMsg}>
              {t('paywall.alreadyPro')}
            </ThemedText>
          ) : isAdsRemoved ? (
            <ThemedText variant="body" tone="accent" style={styles.stateMsg}>
              {t('paywall.alreadyAdsRemoved')}
            </ThemedText>
          ) : !configured ? (
            <ThemedText variant="body" tone="fire" style={styles.stateMsg}>
              {t('paywall.errors.notConfigured')}
            </ThemedText>
          ) : loading ? (
            <ThemedText variant="body" tone="textMuted" style={styles.stateMsg}>
              {t('common.loading')}
            </ThemedText>
          ) : packages.length === 0 ? (
            <ThemedText variant="body" tone="fire" style={styles.stateMsg}>
              {t('paywall.errors.noOffering')}
            </ThemedText>
          ) : (
            <View style={styles.packages}>
              {packages.map((pkg) => {
                const { label, hint } = packageLabel(pkg, t);
                return (
                  <Pressable
                    key={pkg.identifier}
                    onPress={() => buy(pkg)}
                    disabled={busyId !== null}
                    style={styles.packageCard}>
                    <WobblyBorder stroke={colors.accent} strokeWidth={1.4} />
                    <View style={styles.packageRow}>
                      <View style={styles.packageInfo}>
                        <ThemedText variant="body">{label}</ThemedText>
                        {hint && (
                          <ThemedText variant="label" tone="accent">
                            {hint}
                          </ThemedText>
                        )}
                      </View>
                      <ThemedText variant="body" tone="accent">
                        {busyId === pkg.identifier ? t('common.loading') : pkg.product.priceString}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {message && (
            <ThemedText variant="body" tone={message.tone} style={styles.message}>
              {message.text}
            </ThemedText>
          )}

          <SketchButton
            label={restoring ? t('common.loading') : t('paywall.restorePurchases')}
            onPress={restore}
            disabled={restoring || !configured}
            textTone="textMuted"
            style={styles.restoreBtn}
          />
        </View>
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  subtitle: {
    marginTop: -Spacing.xs,
  },
  stateMsg: {
    marginTop: Spacing.md,
  },
  packages: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  packageCard: {
    position: 'relative',
    padding: Spacing.md,
  },
  packageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  packageInfo: {
    gap: Spacing.xs / 2,
  },
  message: {
    textAlign: 'center',
  },
  restoreBtn: {
    marginTop: Spacing.lg,
    alignSelf: 'center',
  },
});
