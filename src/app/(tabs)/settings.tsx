import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FrequencySelector } from '@/components/FrequencySelector';
import { PaperBackground } from '@/components/PaperBackground';
import { SketchToggle } from '@/components/SketchToggle';
import { SketchUnderline } from '@/components/SketchUnderline';
import { ThemeChips } from '@/components/ThemeChips';
import { ThemedText } from '@/components/ThemedText';
import { TimePicker } from '@/components/TimePicker';
import { WobblyBorder } from '@/components/WobblyBorder';
import { Links } from '@/constants/links';
import { Spacing } from '@/constants/layout';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { useTranslation } from '@/i18n/useTranslation';
import { useAuth } from '@/hooks/useAuth';
import { usePurchases } from '@/hooks/usePurchases';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/use-theme';
import type { QuoteTag } from '@/types/quote';
import { FREE_FREQUENCY_MAX, FREQUENCY_OPTIONS, type Frequency, type ThemeMode } from '@/types/settings';
import { isValidWindow, toMinutes } from '@/utils/timeUtils';

const THEME_MODES: ThemeMode[] = ['dark', 'light', 'system'];

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { settings, update, setThemeMode, setLanguage } = useSettings();
  const { user, configured: authConfigured, signOut, deleteAccount } = useAuth();
  const { configured: purchasesConfigured, isPro, isAdsRemoved } = usePurchases();
  const [timeError, setTimeError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // 7/10 bildirim Pro'ya özel — satın almalar bu platformda kapalıysa gate yok.
  const proOnlyFrequencies: Frequency[] =
    purchasesConfigured && !isPro ? FREQUENCY_OPTIONS.filter((f) => f > FREE_FREQUENCY_MAX) : [];

  const confirmSignOut = () => {
    Alert.alert(t('settings.account.signOutConfirmTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.account.signOut'), style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  const runDeleteAccount = async () => {
    setDeletingAccount(true);
    const { error } = await deleteAccount();
    setDeletingAccount(false);
    if (error) Alert.alert(t('settings.account.deleteAccountErrorTitle'), t(error));
  };

  const confirmDeleteAccount = () => {
    Alert.alert(t('settings.account.deleteAccountConfirmTitle'), t('settings.account.deleteAccountConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.account.deleteAccount'), style: 'destructive', onPress: () => void runDeleteAccount() },
    ]);
  };

  const tryUpdateTimes = (startH: number, startM: number, endH: number, endM: number) => {
    if (!isValidWindow(toMinutes(startH, startM), toMinutes(endH, endM))) {
      setTimeError(t('settings.schedule.timeRangeError'));
      return;
    }
    setTimeError(null);
    update({ startHour: startH, startMinute: startM, endHour: endH, endMinute: endM });
  };

  const toggleTheme = (tag: QuoteTag) => {
    const set = new Set(settings.themes);
    if (set.has(tag)) set.delete(tag);
    else set.add(tag);
    update({ themes: [...set] });
  };

  const openLink = (url: string) => {
    if (!url) {
      Alert.alert(t('common.comingSoon'));
      return;
    }
    void Linking.openURL(url);
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText variant="heading">{t('settings.screenTitle')}</ThemedText>

          {/* Hesap — en üstte: global ürün deseni (profil + upgrade önce gelir) */}
          {authConfigured && (
            <Section title={t('settings.sections.account')}>
              {user ? (
                <>
                  <Row label={t('settings.account.signedInAs')}>
                    <ThemedText variant="body" tone="textMuted" numberOfLines={1} style={styles.emailValue}>
                      {user.email}
                    </ThemedText>
                  </Row>
                  {(isPro || isAdsRemoved) && (
                    <ThemedText variant="label" tone="accent">
                      {isPro ? t('settings.premium.proActive') : t('settings.premium.adsRemovedActive')}
                    </ThemedText>
                  )}
                  <Pressable onPress={confirmSignOut}>
                    <ThemedText variant="body" tone="fire" style={styles.link}>
                      {t('settings.account.signOut')}
                    </ThemedText>
                  </Pressable>
                  <Pressable onPress={confirmDeleteAccount} disabled={deletingAccount}>
                    <ThemedText variant="body" tone="fire" style={[styles.link, deletingAccount && styles.linkDisabled]}>
                      {deletingAccount ? t('common.loading') : t('settings.account.deleteAccount')}
                    </ThemedText>
                  </Pressable>
                </>
              ) : (
                <>
                  <ThemedText variant="body" tone="textMuted">
                    {t('settings.account.guestHint')}
                  </ThemedText>
                  <Pressable onPress={() => router.push('/auth')} accessibilityRole="button">
                    <ThemedText variant="body" tone="accent" style={styles.link}>
                      {t('settings.account.signInLink')}
                    </ThemedText>
                  </Pressable>
                </>
              )}
            </Section>
          )}

          {/* Pro kartı — ücretsiz kullanıcıya değer önerisi her zaman görünür */}
          {purchasesConfigured && !isPro && (
            <Pressable
              onPress={() => router.push('/paywall')}
              style={styles.proCard}
              accessibilityRole="button"
              accessibilityLabel={t('settings.premium.cardTitle')}>
              <WobblyBorder stroke={colors.accent} strokeWidth={1.6} inset={2} />
              <ThemedText variant="body" tone="accent" style={styles.proCardTitle}>
                {t('settings.premium.cardTitle')}
              </ThemedText>
              <ThemedText variant="label" tone="textMuted">
                {t('settings.premium.cardBenefits')}
              </ThemedText>
              <ThemedText variant="body" tone="accent">
                {t('settings.premium.cardCta')} →
              </ThemedText>
            </Pressable>
          )}
          {purchasesConfigured && (
            <Pressable onPress={() => router.push('/packs')}>
              <ThemedText variant="body" tone="text" style={styles.link}>
                {t('settings.premium.packsLink')}
              </ThemedText>
            </Pressable>
          )}

          {/* Bildirimler */}
          <Section title={t('settings.sections.notifications')}>
            <Row label={settings.notificationsEnabled
              ? t('settings.notifications.masterToggle')
              : t('settings.notifications.masterToggleOff')}>
              <SketchToggle
                value={settings.notificationsEnabled}
                onChange={(v) => update({ notificationsEnabled: v })}
                accessibilityLabel={
                  settings.notificationsEnabled
                    ? t('settings.notifications.masterToggle')
                    : t('settings.notifications.masterToggleOff')
                }
              />
            </Row>
            <View style={styles.stack}>
              <ThemedText variant="label" tone="textMuted">
                {t('settings.notifications.frequencyLabel')}
              </ThemedText>
              <FrequencySelector
                value={settings.frequency}
                onChange={(f: Frequency) => update({ frequency: f })}
                lockedValues={proOnlyFrequencies}
                onLockedPress={() => router.push('/paywall')}
              />
              {proOnlyFrequencies.length > 0 && (
                <ThemedText variant="label" tone="textMuted">
                  {t('settings.notifications.lockedHint')}
                </ThemedText>
              )}
            </View>
          </Section>

          {/* Zamanlama */}
          <Section title={t('settings.sections.schedule')}>
            <View style={styles.timeRow}>
              <View style={styles.timeCol}>
                <ThemedText variant="label" tone="textMuted">
                  {t('settings.schedule.startTime')}
                </ThemedText>
                <TimePicker
                  hour={settings.startHour}
                  minute={settings.startMinute}
                  onChange={(h, m) =>
                    tryUpdateTimes(h, m, settings.endHour, settings.endMinute)
                  }
                />
              </View>
              <View style={styles.timeCol}>
                <ThemedText variant="label" tone="textMuted">
                  {t('settings.schedule.endTime')}
                </ThemedText>
                <TimePicker
                  hour={settings.endHour}
                  minute={settings.endMinute}
                  onChange={(h, m) =>
                    tryUpdateTimes(settings.startHour, settings.startMinute, h, m)
                  }
                />
              </View>
            </View>
            {timeError && (
              <ThemedText variant="label" tone="fire">
                {timeError}
              </ThemedText>
            )}
            <Row label={t('settings.schedule.weekendsToggle')}>
              <SketchToggle
                value={settings.disableWeekends}
                onChange={(v) => update({ disableWeekends: v })}
                accessibilityLabel={t('settings.schedule.weekendsToggle')}
              />
            </Row>
          </Section>

          {/* Görünüm */}
          <Section title={t('settings.sections.appearance')}>
            <View style={styles.stack}>
              <ThemedText variant="label" tone="textMuted">
                {t('settings.appearance.themeLabel')}
              </ThemedText>
              <View style={styles.segment}>
                {THEME_MODES.map((mode) => {
                  const selected = settings.themeMode === mode;
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => setThemeMode(mode)}
                      style={styles.segmentItem}>
                      {selected && <WobblyBorder stroke={colors.accent} strokeWidth={1.4} inset={2} />}
                      <ThemedText variant="body" tone={selected ? 'accent' : 'textMuted'}>
                        {t(`settings.appearance.themes.${mode}`)}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.stack}>
              <ThemedText variant="label" tone="textMuted">
                {t('settings.appearance.languageLabel')}
              </ThemedText>
              <View style={styles.langWrap}>
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const selected = settings.language === lang.code;
                  return (
                    <Pressable
                      key={lang.code}
                      disabled={!lang.available}
                      onPress={() => lang.available && setLanguage(lang.code)}
                      style={styles.langItem}>
                      <ThemedText
                        variant="body"
                        tone={selected ? 'accent' : lang.available ? 'text' : 'textMuted'}>
                        {lang.name}
                      </ThemedText>
                      {selected && (
                        <ThemedText variant="label" tone="accent">
                          {' '}✓
                        </ThemedText>
                      )}
                      {!lang.available && (
                        <ThemedText variant="label" tone="textMuted">
                          {' '}· {t('common.comingSoon')}
                        </ThemedText>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Section>

          {/* İlgi Alanları */}
          <Section title={t('settings.sections.preferences')}>
            <ThemeChips selected={settings.themes} onToggle={toggleTheme} />
            <ThemedText variant="label" tone="textMuted">
              {t('settings.preferences.hint')}
            </ThemedText>
          </Section>

          {/* Hakkında */}
          <Section title={t('settings.sections.about')}>
            <Row label={t('settings.about.version')}>
              <ThemedText variant="body" tone="textMuted">
                {version}
              </ThemedText>
            </Row>
            <Pressable onPress={() => openLink(Links.rateAndroid)}>
              <ThemedText variant="body" tone="text" style={styles.link}>
                {t('settings.about.rateApp')}
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => openLink(Links.privacyPolicy)}>
              <ThemedText variant="body" tone="text" style={styles.link}>
                {t('settings.about.privacyPolicy')}
              </ThemedText>
            </Pressable>
            <ThemedText variant="label" tone="textMuted" style={styles.madeWith}>
              {t('settings.about.madeWith')}
            </ThemedText>
          </Section>
        </ScrollView>
      </SafeAreaView>
    </PaperBackground>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View>
        <ThemedText variant="body" tone="accent" style={styles.sectionTitle}>
          {title}
        </ThemedText>
        <View style={styles.sectionUnderline}>
          <SketchUnderline />
        </View>
      </View>
      {children}
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <ThemedText variant="body" style={styles.rowLabel}>
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: Spacing.lg,
    gap: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  section: {
    gap: Spacing.md,
  },
  sectionTitle: {
    letterSpacing: 1,
  },
  sectionUnderline: {
    width: 100,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  rowLabel: {
    flexShrink: 1,
  },
  stack: {
    gap: Spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  timeCol: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  segment: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  segmentItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langWrap: {
    gap: Spacing.sm,
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  link: {
    paddingVertical: Spacing.xs,
  },
  linkDisabled: {
    opacity: 0.5,
  },
  madeWith: {
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  emailValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  proCard: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  proCardTitle: {
    letterSpacing: 1,
  },
});
