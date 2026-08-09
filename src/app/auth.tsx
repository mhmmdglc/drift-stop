import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppleSignInButton } from '@/components/AppleSignInButton';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { PaperBackground } from '@/components/PaperBackground';
import { SketchButton } from '@/components/SketchButton';
import { ThemedText } from '@/components/ThemedText';
import { WobblyBorder } from '@/components/WobblyBorder';
import { Spacing } from '@/constants/layout';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import { appleSignInAvailable, googleSignInAvailable } from '@/lib/socialAuth';

type Mode = 'signIn' | 'signUp';

export default function AuthScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail, resendConfirmation, sendPasswordReset, signInWithProvider } =
    useAuth();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * Kayıt başarılı oldu, onay maili bekleniyor. Bu bayrak olmadan kullanıcı
   * "maili kontrol et" yazısıyla baş başa kalıyordu: mail gelmezse ekranda
   * yapabileceği hiçbir şey yoktu.
   */
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [resending, setResending] = useState(false);
  const [socialBusy, setSocialBusy] = useState<'google' | 'apple' | null>(null);
  /** Apple düğmesi: yalnızca iOS'ta ve cihaz destekliyorsa. Async olduğu için state. */
  const [appleReady, setAppleReady] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    let active = true;
    void appleSignInAvailable().then((ok) => {
      if (active) setAppleReady(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  const social = async (provider: 'google' | 'apple') => {
    // Apple'ın yerel düğmesi sönükleştirilmiyor (marka kuralı), o yüzden "aynı
    // anda tek deneme" kuralını burada da bir kez daha uyguluyoruz.
    if (socialBusy !== null || submitting) return;
    setSocialBusy(provider);
    setError(null);
    setNotice(null);
    const result = await signInWithProvider(provider);
    setSocialBusy(null);
    // Vazgeçmek de `error: null` döner; ekranda hiçbir şey değişmez, doğrusu bu.
    if (result.error) setError(t(result.error));
    else if (router.canGoBack()) router.back();
  };

  const emailValid = /\S+@\S+\.\S+/.test(email.trim());
  const passwordValid = password.length >= 6;
  const canSubmit = emailValid && passwordValid && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    const result =
      mode === 'signIn' ? await signInWithEmail(email, password) : await signUpWithEmail(email, password);
    setSubmitting(false);

    if (result.error) {
      setError(t(result.error));
      return;
    }
    if (mode === 'signUp') {
      // Girişe geçir ve şifreyi temizle: hesap var ama oturum YOK (onay bekliyor),
      // ve kullanıcı aynı formda takılı kalmasın.
      setNotice(t('auth.signUpSuccess'));
      setAwaitingConfirmation(true);
      setMode('signIn');
      setPassword('');
      return;
    }
    router.back();
  };

  const forgotPassword = async () => {
    // Şifre alanı boş olabilir; sıfırlama yalnızca e-posta ister.
    if (!emailValid) {
      setError(t('auth.errors.emailRequiredForReset'));
      return;
    }
    setResending(true);
    setError(null);
    setNotice(null);
    const result = await sendPasswordReset(email);
    setResending(false);
    if (result.error) setError(t(result.error));
    else setNotice(t('auth.resetSent'));
  };

  const resend = async () => {
    setResending(true);
    setError(null);
    const result = await resendConfirmation(email);
    setResending(false);
    setError(result.error ? t(result.error) : null);
    if (!result.error) setNotice(t('auth.resendSuccess'));
  };

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe}>
        {/* Android'de `behavior` undefined bırakılmıştı, yani bu sarmalayıcı hiçbir
            şey yapmıyordu: klavye açılınca gönder butonu klavyenin ARKASINDA kalıyor
            ve forma basmanın hiçbir yolu olmuyordu (ekranda görüldü). `height`
            Android'in doğru davranışı; ayrıca içerik artık kaydırılabilir. */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <ThemedText variant="label" tone="textMuted">
                {t('auth.skip')}
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag">
            <ThemedText variant="heading">
              {mode === 'signIn' ? t('auth.signInTitle') : t('auth.signUpTitle')}
            </ThemedText>
            <ThemedText variant="body" tone="textMuted" style={styles.subtitle}>
              {t('auth.subtitle')}
            </ThemedText>

            {/* Sosyal giriş formun ÜSTÜNDE: tek dokunuşluk yol bu, e-posta
                doğrulaması beklemeden hesap açılıyor. Hiçbir sağlayıcı
                yapılandırılmamışsa blok tamamen gizleniyor. */}
            {(googleSignInAvailable || appleReady) && (
              <View style={styles.social}>
                {googleSignInAvailable && (
                  <GoogleSignInButton
                    label={t('auth.continueWithGoogle')}
                    onPress={() => void social('google')}
                    busy={socialBusy === 'google'}
                    disabled={socialBusy !== null || submitting}
                  />
                )}
                {appleReady && (
                  <>
                    <AppleSignInButton
                      label={t('auth.continueWithApple')}
                      onPress={() => void social('apple')}
                      disabled={socialBusy !== null || submitting}
                    />
                    {/* "E-postamı Gizle" ayrı bir hesap yaratıyor: Pro'sunu bulamayan
                        kullanıcının en olası destek sorusu bu, önceden söylüyoruz. */}
                    <ThemedText variant="label" tone="textMuted">
                      {t('auth.appleRelayHint')}
                    </ThemedText>
                  </>
                )}
                <ThemedText variant="label" tone="textMuted" style={styles.socialDivider}>
                  {t('auth.orEmail')}
                </ThemedText>
              </View>
            )}

            <View style={styles.field}>
              <ThemedText variant="label" tone="textMuted">
                {t('auth.emailLabel')}
              </ThemedText>
              <View style={styles.inputWrap}>
                <WobblyBorder stroke={colors.faintLine} strokeWidth={1.4} doubleStroke={false} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('auth.emailPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  submitBehavior="submit"
                  style={[styles.input, { color: colors.text }]}
                />
              </View>
            </View>

            <View style={styles.field}>
              <ThemedText variant="label" tone="textMuted">
                {t('auth.passwordLabel')}
              </ThemedText>
              <View style={styles.inputWrap}>
                <WobblyBorder stroke={colors.faintLine} strokeWidth={1.4} doubleStroke={false} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('auth.passwordPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                  textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
                  returnKeyType="go"
                  onSubmitEditing={() => void submit()}
                  ref={passwordRef}
                  style={[styles.input, { color: colors.text }]}
                />
              </View>
              {mode === 'signUp' && (
                <ThemedText variant="label" tone="textMuted">
                  {t('auth.passwordHint')}
                </ThemedText>
              )}
            </View>

            {error && (
              <ThemedText variant="body" tone="fire">
                {error}
              </ThemedText>
            )}
            {notice && (
              <ThemedText variant="body" tone="accent">
                {notice}
              </ThemedText>
            )}

            <SketchButton
              label={
                submitting
                  ? t('common.loading')
                  : mode === 'signIn'
                    ? t('auth.signInButton')
                    : t('auth.signUpButton')
              }
              onPress={submit}
              disabled={!canSubmit}
              style={styles.submitBtn}
            />

            {mode === 'signIn' && (
              <Pressable
                onPress={() => void forgotPassword()}
                disabled={resending}
                style={styles.switchMode}>
                <ThemedText variant="label" tone="textMuted">
                  {resending ? t('common.loading') : t('auth.forgotPassword')}
                </ThemedText>
              </Pressable>
            )}

            {awaitingConfirmation && (
              <Pressable onPress={() => void resend()} disabled={resending} style={styles.switchMode}>
                <ThemedText variant="label" tone="textMuted">
                  {resending ? t('common.loading') : t('auth.resendConfirmation')}
                </ThemedText>
              </Pressable>
            )}

            <Pressable
              onPress={() => {
                setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'));
                setError(null);
                setNotice(null);
              }}
              style={styles.switchMode}>
              <ThemedText variant="body" tone="accent">
                {mode === 'signIn' ? t('auth.switchToSignUp') : t('auth.switchToSignIn')}
              </ThemedText>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  content: {
    flexGrow: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
    justifyContent: 'center',
  },
  subtitle: {
    marginBottom: Spacing.md,
  },
  social: {
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  socialDivider: {
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  field: {
    gap: Spacing.xs,
  },
  inputWrap: {
    position: 'relative',
  },
  input: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 16,
  },
  submitBtn: {
    marginTop: Spacing.md,
    alignSelf: 'center',
  },
  switchMode: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
  },
});
