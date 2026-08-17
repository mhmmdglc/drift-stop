import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaperBackground } from '@/components/PaperBackground';
import { SketchButton } from '@/components/SketchButton';
import { SketchTextInput } from '@/components/SketchTextInput';
import { ThemedText } from '@/components/ThemedText';
import { Spacing } from '@/constants/layout';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useTranslation } from '@/i18n/useTranslation';
import {
  VAULT_FREE_ACTIVE_LIMIT,
  VAULT_TEXT_MAX_LENGTH,
  VAULT_TEXT_MIN_LENGTH,
  activeMessageCount,
  addMessage,
} from '@/utils/vault';

/**
 * Kasa editörü — ayrı bir modal route (`w2.1-ux.md` §3.1), Settings'e gömülü
 * DEĞİL: 4-280 karakterlik çok satırlı girdi klavye açıldığında Settings'in
 * kaydırılan listesini iter/kaçırır (`auth.tsx`'te bir kez yaşanmış
 * `KeyboardAvoidingView` tuzağıyla AYNI risk sınıfı).
 *
 * Free-limit kapısı BURADA, listede DEĞİL (`w2.1-ux.md` §2.3): kontrol mantığı
 * TEK yerde — liste ekranının press handler'ında ikinci bir kopya kontrol
 * açmak iki yerin senkron kalması gereken bir kural yaratırdı.
 */
export default function VaultEditorScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { entitled, entitlementKnown, purchasesConfigured } = useEntitlement();
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [text, setText] = useState('');

  const reload = useCallback(() => {
    let active = true;
    activeMessageCount().then((count) => {
      if (active) setActiveCount(count);
    });
    return () => {
      active = false;
    };
  }, []);
  useFocusEffect(reload);

  // `purchasesConfigured` false ise (ör. iOS'ta RevenueCat anahtarı yok) kapı
  // HİÇ uygulanmaz — mevcut "her platformda gating configured'a bağlı" kuralı
  // (`PRODUCT.md` §7). Deneme de `entitled`i açar (`useEntitlement` zaten
  // birleştiriyor), kasa `useAuth`a hiç bakmaz.
  const gateApplies = purchasesConfigured && !entitled;
  // Hak VEYA aktif sayı henüz bilinmiyorsa kesin karara varmadan bekle — Pro
  // kullanıcıyı hak gelmeden yanlışlıkla kilitli göstermemek için
  // (`quote/[id].tsx:83-86`'daki AYNI kural).
  const pending = gateApplies && (!entitlementKnown || activeCount === null);
  const locked =
    gateApplies &&
    entitlementKnown &&
    activeCount !== null &&
    activeCount >= VAULT_FREE_ACTIVE_LIMIT;

  const trimmedLength = text.trim().length;
  const canSave = trimmedLength >= VAULT_TEXT_MIN_LENGTH && trimmedLength <= VAULT_TEXT_MAX_LENGTH;

  const onSave = async () => {
    const saved = await addMessage(text);
    if (saved) router.back();
  };

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}>
              <ThemedText variant="label" tone="textMuted">
                {t('common.cancel')}
              </ThemedText>
            </Pressable>
          </View>

          {pending ? (
            <View style={styles.loadingWrap}>
              <ThemedText variant="body" tone="textMuted">
                {t('common.loading')}
              </ThemedText>
            </View>
          ) : locked ? (
            <View style={styles.locked}>
              <ThemedText variant="quote" tone="textMuted" style={styles.lockedText}>
                🔒 {t('vault.proGateTitle')}
              </ThemedText>
              <ThemedText variant="body" tone="textMuted" style={styles.lockedText}>
                {t('vault.proGateBody')}
              </ThemedText>
              <SketchButton
                label={t('packs.unlockCta')}
                onPress={() => router.push('/paywall')}
                style={styles.unlockBtn}
              />
            </View>
          ) : (
            <View style={styles.content}>
              <ThemedText variant="heading">{t('vault.editorTitle')}</ThemedText>
              <ThemedText variant="body" tone="textMuted">
                {t('vault.editorHint')}
              </ThemedText>
              <SketchTextInput
                value={text}
                onChangeText={setText}
                placeholder={t('vault.editorPlaceholder')}
                maxLength={VAULT_TEXT_MAX_LENGTH}
                variant="quote"
                multiline
                numberOfLines={5}
                autoFocus
                accessibilityLabel={t('vault.editorTitle')}
                accessibilityHint={t('vault.editorHint')}
              />
              <ThemedText variant="label" tone="textMuted">
                {t('vault.editorLimitHint')}
              </ThemedText>
              <ThemedText variant="label" tone="textMuted" style={styles.charCount}>
                {t('vault.charCount', { count: text.length })}
              </ThemedText>
              <SketchButton
                label={t('common.save')}
                onPress={() => void onSave()}
                disabled={!canSave}
                style={styles.saveButton}
              />
            </View>
          )}
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
  },
  charCount: {
    textAlign: 'right',
  },
  saveButton: {
    alignSelf: 'center',
    marginTop: Spacing.sm,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locked: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  lockedText: {
    textAlign: 'center',
  },
  unlockBtn: {
    marginTop: Spacing.md,
  },
});
