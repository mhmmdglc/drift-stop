import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { SketchButton } from '@/components/SketchButton';
import { ThemedText } from '@/components/ThemedText';
import { Spacing } from '@/constants/layout';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useTranslation } from '@/i18n/useTranslation';

/**
 * Premium bir liste boş kaldığında ne yazılacağına tek yerden karar verir.
 *
 * NEDEN AYRI BİR BİLEŞEN: bu metin iki ekranda (paket detayı ve yazar detayı)
 * birebir kopyalanmıştı ve ikisi de **hak sahibi misafire** asla gerçekleşmeyecek
 * bir söz veriyordu: "birazdan burada olacak". Premium satırlar RLS gereği
 * yalnızca oturum açmış ve `profiles.is_premium = true` olan kullanıcıya dönüyor
 * (bkz. `services/quotesSync.ts`), misafirin ise profili hiç yok — yani bekleme
 * sonsuza kadar sürüyordu. Karar tek yerde durmazsa bir ekranda düzeltilip
 * diğerinde unutulur.
 *
 * Üç durum var ve üçü de farklı:
 * - **Hak var, oturum yok:** içerik ASLA gelmeyecek. Giriş çağrısı gösterilir.
 * - **Hak var, oturum var:** indirme gerçekten sürüyor (2-5 sn). Bekleme metni.
 * - **Hak yok:** buraya normalde gelinmez (kilit ekranı devrede), ama gelinirse
 *   bekleme metni yanlış olmaz — okuma katmanı zaten boş döner.
 */
export function PremiumContentEmpty() {
  const { t } = useTranslation();
  const router = useRouter();
  const { entitled } = useEntitlement();
  const { user, configured: authConfigured } = useAuth();

  const needsAccount = entitled && authConfigured && !user;

  if (!needsAccount) {
    return (
      <View style={styles.empty}>
        <ThemedText variant="body" tone="textMuted" style={styles.text}>
          {t('packs.syncingBody')}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.empty}>
      <ThemedText variant="quote" tone="textMuted" style={styles.title}>
        {t('packs.needsAccountTitle')}
      </ThemedText>
      <ThemedText variant="body" tone="textMuted" style={styles.text}>
        {t('packs.needsAccountBody')}
      </ThemedText>
      <SketchButton
        label={t('packs.needsAccountCta')}
        onPress={() => router.push('/auth')}
        style={styles.cta}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  text: {
    textAlign: 'center',
  },
  cta: {
    marginTop: Spacing.lg,
  },
});
