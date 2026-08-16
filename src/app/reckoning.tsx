import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaperBackground } from '@/components/PaperBackground';
import { SketchButton } from '@/components/SketchButton';
import { FlameSketch } from '@/components/SketchOnboardingIcons';
import { ThemedText } from '@/components/ThemedText';
import { WobblyBorder } from '@/components/WobblyBorder';
import { Spacing } from '@/constants/layout';
import { useReckoning } from '@/hooks/useReckoning';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import { parseDateKey, type ReckoningAnswer, type ReckoningLog } from '@/utils/reckoning';
import { dateKey } from '@/utils/timeUtils';

/**
 * Haftalık şeridin 7 günü (en eskiden en yeniye). `weekSummary` yalnızca toplamları
 * döndürür — ekran, kutucuk başına durumu göstermek için kendi (saf, test edilebilir
 * olmasına gerek olmayan sunum) döngüsünü kurar; `w1.3-ux.md` §3 gün sırasını dikte
 * etmiyor: "en eskiden en yeniye render etmek yeterli".
 */
function buildWeekDays(
  log: ReckoningLog,
  today: string,
  locale: string
): { key: string; answer: ReckoningAnswer | null; isToday: boolean; label: string }[] {
  const days: { key: string; answer: ReckoningAnswer | null; isToday: boolean; label: string }[] =
    [];
  const cursor = parseDateKey(today);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(cursor);
    d.setDate(cursor.getDate() - i);
    const key = dateKey(d);
    let label = '·';
    try {
      label = new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(d);
    } catch {
      // Intl desteklenmeyen bir motor/locale ise nokta yer tutucusu kalır.
    }
    days.push({ key, answer: log[key] ?? null, isToday: key === today, label });
  }
  return days;
}

function DayBox({ answer, isToday }: { answer: ReckoningAnswer | null; isToday: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.dayBox}>
      <WobblyBorder
        stroke={isToday && !answer ? colors.accent : colors.faintLine}
        strokeWidth={1.2}
        inset={2}
        doubleStroke={false}
        dashed={isToday && !answer}
      />
      {answer === 'resisted' && (
        <View style={[styles.dayDot, { backgroundColor: colors.fire }]} />
      )}
      {answer === 'drifted' && (
        <ThemedText variant="label" tone="textMuted">
          ✕
        </ThemedText>
      )}
    </View>
  );
}

export default function ReckoningScreen() {
  const { colors } = useTheme();
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { loaded, log, today, streak, week, answeredToday, hasAnyAnswer, answer } =
    useReckoning();

  const respond = (value: ReckoningAnswer) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    answer(value);
  };

  const streakTone = streak > 0 ? 'fire' : 'textMuted';

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('reckoning.closeButton')}>
            <ThemedText variant="label" tone="textMuted">
              {t('reckoning.closeButton')}
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.content}>
          <ThemedText variant="heading">{t('reckoning.title')}</ThemedText>

          {!loaded ? (
            <ThemedText variant="body" tone="textMuted">
              {t('common.loading')}
            </ThemedText>
          ) : answeredToday ? (
            <View
              accessible
              accessibilityLabel={t('reckoning.a11yAnsweredToday', {
                answer:
                  answeredToday === 'resisted'
                    ? t('reckoning.actionResisted')
                    : t('reckoning.actionDrifted'),
              })}>
              <ThemedText variant="heading" tone={answeredToday === 'resisted' ? 'accent' : 'text'}>
                {t(
                  answeredToday === 'resisted'
                    ? 'reckoning.answeredResisted'
                    : 'reckoning.answeredDrifted'
                )}
                {answeredToday === 'resisted' ? ' 🔥' : ''}
              </ThemedText>
            </View>
          ) : (
            <>
              <ThemedText variant="body">{t('reckoning.question')}</ThemedText>
              <View style={styles.buttonRow}>
                <SketchButton
                  label={t('reckoning.actionResisted')}
                  onPress={() => respond('resisted')}
                  stroke={colors.accent}
                  textTone="accent"
                  size="large"
                  style={styles.button}
                />
                <SketchButton
                  label={t('reckoning.actionDrifted')}
                  onPress={() => respond('drifted')}
                  stroke={colors.faintLine}
                  textTone="textMuted"
                  size="large"
                  style={styles.button}
                />
              </View>
              <ThemedText variant="label" tone="textMuted">
                {t('reckoning.honestyHint')}
              </ThemedText>
            </>
          )}

          {loaded && hasAnyAnswer ? (
            <View style={styles.summaryBlock}>
              <View style={styles.summaryRow}>
                <FlameSketch size={20} color={streak > 0 ? colors.fire : colors.textMuted} />
                <ThemedText variant="heading" tone={streakTone}>
                  {streak}
                </ThemedText>
                <ThemedText variant="body" tone="textMuted">
                  {t('reckoning.weekLabel', { resisted: week.resisted, total: week.total })}
                </ThemedText>
              </View>
              <View
                style={styles.weekRow}
                accessible
                accessibilityLabel={t('reckoning.weekLabel', {
                  resisted: week.resisted,
                  total: week.total,
                })}>
                {buildWeekDays(log, today, locale).map((d) => (
                  <View key={d.key} style={styles.dayCol}>
                    <DayBox answer={d.answer} isToday={d.isToday} />
                    <ThemedText variant="label" tone="textMuted">
                      {d.label}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>
          ) : loaded ? (
            <ThemedText variant="label" tone="textMuted" style={styles.emptyHint}>
              {t('reckoning.emptyHint')}
            </ThemedText>
          ) : null}

          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={12}
            accessibilityRole="link"
            accessibilityLabel={`${t('reckoning.settingsLabel')} ${t('reckoning.settingsLink')}`}
            style={styles.settingsLink}>
            <ThemedText variant="label" tone="textMuted">
              {t('reckoning.settingsLabel')} → {t('reckoning.settingsLink')}
            </ThemedText>
          </Pressable>
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
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  button: {
    flex: 1,
  },
  summaryBlock: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCol: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dayBox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  emptyHint: {
    marginTop: Spacing.md,
  },
  settingsLink: {
    marginTop: 'auto',
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
  },
});
