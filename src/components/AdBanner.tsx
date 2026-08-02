import { useRouter } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

import { ThemedText } from '@/components/ThemedText';
import { AdUnits, hasBannerUnit } from '@/constants/adUnits';
import { Spacing } from '@/constants/layout';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useTranslation } from '@/i18n/useTranslation';
import { adsEnabled, getPersonalizedAds, subscribeToAdPersonalization } from '@/utils/ads';

/** Home altındaki banner. Expo Go'da, aktif denemede veya reklamsız satın alım/Pro sonrası hiçbir şey render etmez. */
export function AdBanner() {
  // Deneme de reklamı kaldırır (bkz. useEntitlement / useAdSuppression).
  const { entitled, isAdsRemoved, purchasesConfigured } = useEntitlement();
  const { t } = useTranslation();
  const router = useRouter();
  // ATT diyaloğu banner mount olduktan sonra cevaplanabilir; abone olmazsak
  // banner o oturum boyunca kişiselleştirilmemiş istekte takılı kalır.
  const personalized = useSyncExternalStore(
    subscribeToAdPersonalization,
    getPersonalizedAds,
    getPersonalizedAds
  );
  // `hasBannerUnit` false = yayın derlemesinde gerçek birim id'si yok. Eskiden bu
  // durumda Google'ın test birimine düşülüyordu; gerçek kullanıcıya test reklamı
  // göstermek AdMob politika ihlali. Artık hiç render edilmiyor.
  if (!adsEnabled || entitled || isAdsRemoved || !hasBannerUnit || !AdUnits.banner) return null;
  return (
    <View style={styles.wrap}>
      {/* Reklamın dibinde kalıcı çıkış yolu — paywall'a en doğal giriş noktası */}
      {purchasesConfigured && (
        <Pressable
          onPress={() => router.push('/paywall')}
          accessibilityRole="button"
          accessibilityLabel={t('ads.removeAds')}
          hitSlop={8}
          style={styles.removeLink}>
          <ThemedText variant="label" tone="textMuted">
            {t('ads.removeAds')} ✕
          </ThemedText>
        </Pressable>
      )}
      <BannerAd
        unitId={AdUnits.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: !personalized }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeLink: {
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingBottom: 2,
  },
});
