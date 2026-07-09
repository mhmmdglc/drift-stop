import { StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

import { AdUnits } from '@/constants/adUnits';
import { usePurchases } from '@/hooks/usePurchases';
import { adsEnabled } from '@/utils/ads';

/** Home altındaki banner. Expo Go'da veya reklamsız satın alım/Pro sonrası hiçbir şey render etmez. */
export function AdBanner() {
  const { isAdsRemoved } = usePurchases();
  if (!adsEnabled || isAdsRemoved) return null;
  return (
    <View style={styles.wrap}>
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
});
