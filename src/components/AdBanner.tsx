import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

import { ThemedText } from '@/components/ThemedText';
import { AdUnits } from '@/constants/adUnits';
import { Spacing } from '@/constants/layout';
import { usePurchases } from '@/hooks/usePurchases';
import { useTranslation } from '@/i18n/useTranslation';
import { adsEnabled } from '@/utils/ads';

/** Home altındaki banner. Expo Go'da veya reklamsız satın alım/Pro sonrası hiçbir şey render etmez. */
export function AdBanner() {
  const { isAdsRemoved, configured } = usePurchases();
  const { t } = useTranslation();
  const router = useRouter();
  if (!adsEnabled || isAdsRemoved) return null;
  return (
    <View style={styles.wrap}>
      {/* Reklamın dibinde kalıcı çıkış yolu — paywall'a en doğal giriş noktası */}
      {configured && (
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
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
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
