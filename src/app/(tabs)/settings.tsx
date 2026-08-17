import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FrequencySelector } from '@/components/FrequencySelector';
import { PaperBackground } from '@/components/PaperBackground';
import { SketchTextInput } from '@/components/SketchTextInput';
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
import { useEntitlement } from '@/hooks/useEntitlement';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/use-theme';
import { isAppleRelayEmail } from '@/lib/socialAuth';
import type { QuoteTag } from '@/types/quote';
import {
  FREE_FREQUENCY_MAX,
  FREQUENCY_OPTIONS,
  GOAL_MAX_LENGTH,
  normalizeGoal,
  type Frequency,
  type ThemeMode,
} from '@/types/settings';
import { isValidWindow, toMinutes } from '@/utils/timeUtils';

const THEME_MODES: ThemeMode[] = ['dark', 'light', 'system'];

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { settings, update, setThemeMode, setLanguage } = useSettings();
  const { user, configured: authConfigured, signOut, deleteAccount } = useAuth();
  const { entitled, source, trialDaysLeft, purchasesConfigured, isSubscribed, isAdsRemoved } =
    useEntitlement();
  const [timeError, setTimeError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Günde 3'ten fazla bildirim Pro'ya özel. Aktif deneme de kilidi açar; satın almalar
  // bu platformda kapalıysa (iOS anahtarı yok) ve deneme de bittiyse gate uygulanmaz —
  // aksi halde kullanıcıya kaldıramayacağı bir kilit gösterilirdi.
  const proOnlyFrequencies: Frequency[] =
    purchasesConfigured && !entitled ? FREQUENCY_OPTIONS.filter((f) => f > FREE_FREQUENCY_MAX) : [];

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
        {/* Klavye açıkken başka bir kontrole ilk dokunuş yutulmasın (hedef input'u
            blur → commit yine de çalışır). */}
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
                  {/* `xxxx@privaterelay.appleid.com` bozuk veri gibi görünüyor;
                      tek satırla ne olduğunu söylemek destek sorusunu önlüyor. */}
                  {isAppleRelayEmail(user.email) && (
                    <ThemedText variant="label" tone="textMuted">
                      {t('settings.account.appleRelayNote')}
                    </ThemedText>
                  )}
                  {(isSubscribed || isAdsRemoved) && (
                    <ThemedText variant="label" tone="accent">
                      {isSubscribed
                        ? t('settings.premium.proActive')
                        : t('settings.premium.adsRemovedActive')}
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

          {/* Deneme sürerken kalan gün her açılışta görünür: kıtlığın tek görünür
              işareti bu, yoksa kullanıcı 8. günde habersiz yakalanır. */}
          {source === 'trial' && (
            <ThemedText variant="label" tone="accent">
              {trialDaysLeft <= 1 ? t('trial.lastDay') : t('trial.activeBadge', { count: trialDaysLeft })}
            </ThemedText>
          )}

          {/* Pro kartı — abonesi olmayana değer önerisi her zaman görünür (deneme dahil:
              denemedeki kullanıcı zaten dönüştürmek istediğimiz kişi). */}
          {purchasesConfigured && !isSubscribed && (
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
          {/* Paket tarayıcısı `purchasesConfigured`'a BAĞLI DEĞİL.
              Bağlıyken iOS'ta (RevenueCat anahtarı yok → configured false) 18
              koleksiyona ve 3.325 söze giden TEK kapı kayboluyordu — üstelik deneme
              aktifken, yani denemenin verdiği içeriğe erişim yokken. "Satın alma
              yapılabiliyor mu" ile "içerik var mı" ayrı sorular; paket listesi
              herkese açık metadata ve ekran kilitli/açık durumunu kendisi
              `useEntitlement` ile hesaplıyor. */}
          <Pressable onPress={() => router.push('/packs')}>
            <ThemedText variant="body" tone="text" style={styles.link}>
              {t('settings.premium.packsLink')}
            </ThemedText>
          </Pressable>

          {/* Kasa, packs'ın HEMEN altında — ikisi de parayla ilgili yüzeyler bir
              blok (Pro kartı → packs → kasa), saf kişiselleştirme (Hedefin) ikinci
              blok (`w2.1-ux.md` §5.1). Kasa Pro-ÖZEL DEĞİL (free 1 mesajla tam
              kullanır) — bu yüzden `settings.premium.*` değil kendi `settings.vault.*`
              namespace'inde; kapı burada değil `/vault/new`'in İÇİNDE (§2.3). */}
          <Pressable
            onPress={() => router.push('/vault')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.vault.label')}>
            <ThemedText variant="body" tone="text" style={styles.link}>
              {t('settings.vault.label')}
            </ThemedText>
          </Pressable>

          {/* Hedef — kimlik beyanı: ayar mekaniğinin üstünde, monetizasyon
              yüzeylerinin altında durur. `key`: kaydedilmiş değer dışarıdan
              değişince (ilk diskten yükleme, commit sonrası trim) taslak state'i
              remount ile hizalanır — effect içinde setState'e gerek kalmaz. */}
          <GoalSection
            key={settings.goal ?? ''}
            goal={settings.goal}
            onCommit={(next) => update({ goal: next })}
          />

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
            {/* Ayrı bir Section DEĞİL: hesaplaşma teknik olarak günlük sözlerle AYNI
                kanalda ve ana anahtar şemsiyesinde — ayrı bölüm yanlış bağımsızlık
                izlenimi verir (`w1.3-ux.md` §5). */}
            <Row label={
              settings.reckoningEnabled
                ? t('settings.reckoning.label')
                : t('settings.reckoning.labelOff')
            }>
              <SketchToggle
                value={settings.reckoningEnabled}
                onChange={(v) => update({ reckoningEnabled: v })}
                accessibilityLabel={t('settings.reckoning.label')}
              />
            </Row>
            {/* PRODUCT.md /reckoning erişim yollarından birini "Settings → hint link"
                diye belgeliyordu ama ipucu düz metindi, hiçbir yere gitmiyordu —
                hafta sonu muafiyeti hariç bildirimi kapatan/hiç ilk cevabı vermeyen
                bir kullanıcı için ekrana ulaşacak HİÇBİR yol yoktu (Home şeridi ilk
                cevaba kadar gizli). Cihaz QA'sında bulundu, 2026-08-16. */}
            <Pressable onPress={() => router.push('/reckoning')} accessibilityRole="link">
              <ThemedText variant="label" tone="textMuted" style={styles.link}>
                {t('settings.reckoning.hint')}
              </ThemedText>
            </Pressable>
            {/* Akıllı zamanlama (W3.2): hesaplaşmanın hemen altında — ikisi de
                bildirim ANA anahtarının şemsiyesinde, ayrı bölüm açmak yanlış
                bağımsızlık izlenimi verir (reckoning toggle'ıyla aynı gerekçe). */}
            <Row label={t('settings.smartTiming.label')}>
              <SketchToggle
                value={settings.smartTiming}
                onChange={(v) => update({ smartTiming: v })}
                accessibilityLabel={t('settings.smartTiming.label')}
              />
            </Row>
            <ThemedText variant="label" tone="textMuted">
              {t('settings.smartTiming.hint')}
            </ThemedText>
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
            {/* Android'de bu satır hiç çizilmiyor: Play koşullar bağlantısı
                istemiyor ve Apple'ın EULA'sı Android kullanıcısını bağlamıyor.
                "Yakında" uyarısı veren boş bir satır göstermek de yanlış olurdu
                — eksik değil, o platformda karşılığı yok. */}
            {Links.termsOfUse ? (
              <Pressable onPress={() => openLink(Links.termsOfUse)}>
                <ThemedText variant="body" tone="text" style={styles.link}>
                  {t('settings.about.termsOfUse')}
                </ThemedText>
              </Pressable>
            ) : null}
            <ThemedText variant="label" tone="textMuted" style={styles.madeWith}>
              {t('settings.about.madeWith')}
            </ThemedText>
          </Section>
        </ScrollView>
      </SafeAreaView>
    </PaperBackground>
  );
}

function GoalSection({
  goal,
  onCommit,
}: {
  goal: string | null;
  onCommit: (next: string | null) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(goal ?? '');

  const commit = () => {
    const next = normalizeGoal(draft);
    // 'goal' SCHEDULE_KEYS'te: her update 30 bildirimlik planı iptal edip yeniden
    // kurar, o yüzden yalnızca değer gerçekten değiştiyse yazılır.
    if (next !== goal) onCommit(next);
  };

  // Görüntüle/düzenle ayrımı yok — satır her zaman input; boşaltıp çıkmak = silmek
  // (hint bunu söylüyor, ayrı "sil" butonu gürültü olurdu).
  return (
    <Section title={t('settings.goal.label')}>
      <SketchTextInput
        value={draft}
        onChangeText={setDraft}
        placeholder={t('settings.goal.placeholder')}
        maxLength={GOAL_MAX_LENGTH}
        variant="quote"
        returnKeyType="done"
        onSubmitEditing={commit}
        onBlur={commit}
        accessibilityLabel={t('settings.goal.label')}
        accessibilityHint={t('settings.goal.hint')}
      />
      <ThemedText variant="label" tone="textMuted">
        {t('settings.goal.hint')}
      </ThemedText>
    </Section>
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
