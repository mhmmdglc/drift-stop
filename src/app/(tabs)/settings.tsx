import Constants from 'expo-constants';
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
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/use-theme';
import type { QuoteTag } from '@/types/quote';
import type { Frequency, ThemeMode } from '@/types/settings';
import { isValidWindow, toMinutes } from '@/utils/timeUtils';

const THEME_MODES: ThemeMode[] = ['dark', 'light', 'system'];

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { settings, update, setThemeMode, setLanguage } = useSettings();
  const [timeError, setTimeError] = useState<string | null>(null);

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

          {/* Bildirimler */}
          <Section title={t('settings.sections.notifications')}>
            <Row label={settings.notificationsEnabled
              ? t('settings.notifications.masterToggle')
              : t('settings.notifications.masterToggleOff')}>
              <SketchToggle
                value={settings.notificationsEnabled}
                onChange={(v) => update({ notificationsEnabled: v })}
              />
            </Row>
            <View style={styles.stack}>
              <ThemedText variant="label" tone="textMuted">
                {t('settings.notifications.frequencyLabel')}
              </ThemedText>
              <FrequencySelector
                value={settings.frequency}
                onChange={(f: Frequency) => update({ frequency: f })}
              />
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
  madeWith: {
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
});
