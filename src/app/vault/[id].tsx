import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaperBackground } from '@/components/PaperBackground';
import { SketchButton } from '@/components/SketchButton';
import { ThemedText } from '@/components/ThemedText';
import { Spacing } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import { dateKey } from '@/utils/timeUtils';
import { deleteMessage, listMessages, rearmMessage, type VaultMessage } from '@/utils/vault';

/** İmza satırı için kısa tarih ("3 Mayıs") — `scheduler.ts#vaultDateLabel` ile
 * AYNI Intl çağrısı/fallback gerekçesi: bildirimin ürettiği metinle aynı biçim. */
function formatSignatureDate(at: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(new Date(at));
  } catch {
    return dateKey(new Date(at));
  }
}

/** İdari satır için tam tarih (gün+ay+yıl) — imza yıl taşımadığı için yıllar
 * sonra iki mesaj birbirine karışmasın diye ayrı bir biçim (`w2.1-ux.md` §4.2). */
function formatDeliveredDate(at: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(at));
  } catch {
    return dateKey(new Date(at));
  }
}

type LoadState = 'loading' | 'notFound' | VaultMessage;

export default function VaultDetailScreen() {
  const { colors } = useTheme();
  const { t, locale } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<LoadState>('loading');

  useEffect(() => {
    let active = true;
    const idNum = Number(params.id);
    // Geçersiz id için de setState'i asenkron dala TAŞI (react-hooks/set-state-in-effect
    // kuralı, effect gövdesinde SENKRON setState'i cascading render riski olarak
    // işaretliyor) — Promise.resolve().then() ile diğer dal (listMessages) ile
    // AYNI şekle sokuluyor, davranış değişmiyor (hâlâ ilk render'dan hemen sonra çözülüyor).
    if (!Number.isFinite(idNum)) {
      Promise.resolve().then(() => {
        if (active) setState('notFound');
      });
      return () => {
        active = false;
      };
    }
    listMessages().then((all) => {
      if (!active) return;
      const found = all.find((m) => m.id === idNum);
      setState(found ?? 'notFound');
    });
    return () => {
      active = false;
    };
  }, [params.id]);

  // Güvenlik ağı: uyuyan bir mesaja (id geçerli ama deliveredAt null — hiç
  // teslim edilmemiş ya da "yeniden kur" ile tekrar uykuya dönmüş) bu route'a
  // hiç ULAŞILMAMALI. Ulaşılırsa içerik GÖSTERİLMEDEN listeye yönlendirilir —
  // "uyuyan mesajın içeriği asla gösterilmez" kuralı bu route için de geçerli.
  useEffect(() => {
    if (state !== 'loading' && state !== 'notFound' && state.deliveredAt === null) {
      router.replace('/vault');
    }
  }, [state, router]);

  if (state === 'loading') return null;
  // Yönlendirme yukarıdaki effect'te tetiklendi — geçiş anında bile içerik
  // render EDİLMEZ (yarış penceresi olsa dahi sürpriz kuralı çiğnenmesin).
  if (state !== 'notFound' && state.deliveredAt === null) return null;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/vault'));

  if (state === 'notFound') {
    return (
      <PaperBackground>
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
          <Pressable onPress={goBack} hitSlop={12} style={styles.back}>
            <ArrowLeft size={22} weight="thin" color={colors.textMuted} />
            <ThemedText variant="label" tone="textMuted">
              {t('common.back')}
            </ThemedText>
          </Pressable>
          <View style={styles.notFoundWrap}>
            <ThemedText variant="body" tone="textMuted" style={styles.notFoundText}>
              {t('vault.notFound')}
            </ThemedText>
            <SketchButton
              label={t('vault.backToList')}
              onPress={() => router.replace('/vault')}
              style={styles.notFoundButton}
            />
          </View>
        </SafeAreaView>
      </PaperBackground>
    );
  }

  const message = state;

  const onRearm = async () => {
    await rearmMessage(message.id);
    // Haptic geri dönüş ANINDA — ekranda kalınmıyor (`w2.1-ux.md` §4.4).
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const confirmDelete = () => {
    Alert.alert(t('vault.deleteConfirmTitle'), t('vault.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('vault.delete'),
        style: 'destructive',
        onPress: () => {
          void deleteMessage(message.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.back}>
          <ArrowLeft size={22} weight="thin" color={colors.textMuted} />
          <ThemedText variant="label" tone="textMuted">
            {t('common.back')}
          </ThemedText>
        </Pressable>

        <View style={styles.body}>
          <View style={styles.centerBlock}>
            <ThemedText variant="quoteLarge" style={styles.quoteText}>
              {message.text}
            </ThemedText>
            <ThemedText variant="author" tone="textMuted" style={styles.signature}>
              {t('vault.signature', {
                date: formatSignatureDate(message.deliveredAt as number, locale),
              })}
            </ThemedText>
          </View>

          <View style={styles.actions}>
            <ThemedText variant="label" tone="textMuted" style={styles.deliveredAtText}>
              {t('vault.deliveredAt', {
                date: formatDeliveredDate(message.deliveredAt as number, locale),
              })}
            </ThemedText>
            <SketchButton
              label={t('vault.rearm')}
              onPress={() => void onRearm()}
              stroke={colors.accent}
              textTone="accent"
            />
            <ThemedText variant="label" tone="textMuted" style={styles.rearmHintText}>
              {t('vault.rearmHint')}
            </ThemedText>
          </View>

          <Pressable
            onPress={confirmDelete}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('vault.delete')}
            style={styles.deleteButton}>
            <ThemedText variant="body" tone="fire">
              {t('vault.delete')}
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  body: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  quoteText: {
    textAlign: 'center',
  },
  signature: {
    textAlign: 'center',
  },
  actions: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  deliveredAtText: {
    textAlign: 'center',
  },
  rearmHintText: {
    textAlign: 'center',
  },
  // Yıkıcı eylem, en altta ve görsel olarak ayrık (`settings.tsx` hesap silme
  // hiyerarşisiyle AYNI karar) — "Yeniden kur"la asla eşit ağırlıkta durmaz.
  deleteButton: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  notFoundWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  notFoundText: {
    textAlign: 'center',
  },
  notFoundButton: {
    marginTop: Spacing.md,
  },
});
