import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaperBackground } from '@/components/PaperBackground';
import { SketchButton } from '@/components/SketchButton';
import { ThemedText } from '@/components/ThemedText';
import { WobblyBorder } from '@/components/WobblyBorder';
import { Spacing } from '@/constants/layout';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';

type Mode = 'signIn' | 'signUp';

export default function AuthScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail } = useAuth();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
      setNotice(t('auth.signUpSuccess'));
      return;
    }
    router.back();
  };

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <ThemedText variant="label" tone="textMuted">
                {t('auth.skip')}
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.content}>
            <ThemedText variant="heading">
              {mode === 'signIn' ? t('auth.signInTitle') : t('auth.signUpTitle')}
            </ThemedText>
            <ThemedText variant="body" tone="textMuted" style={styles.subtitle}>
              {t('auth.subtitle')}
            </ThemedText>

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
          </View>
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
    flex: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
    justifyContent: 'center',
  },
  subtitle: {
    marginBottom: Spacing.md,
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
