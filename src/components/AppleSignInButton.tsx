import * as AppleAuthentication from 'expo-apple-authentication';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { SOCIAL_BUTTON_HEIGHT } from '@/components/GoogleSignInButton';
import { Radius } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';

/**
 * Apple ile giriş düğmesi — Apple'ın YEREL düğmesi (`ASAuthorizationAppleIDButton`).
 *
 * Burada el çizimi `SketchButton` kullanılamaz: App Review, Apple logosunu,
 * onaylı metni, oranları ve kontrastı taşımayan bir düğmeyi reddediyor. Yerel
 * bileşen bunların hepsini kendisi getiriyor (üstelik cihaz diline de kendisi
 * çevriliyor). Ekranla uyum sadece `buttonStyle` + `cornerRadius` + ölçüden
 * gelebilir; `backgroundColor`/`borderRadius` vermek yasak ve zaten çalışmıyor.
 *
 * Yükseklik Google düğmesiyle AYNI: Apple'ın kuralı, kendi düğmesinin diğer
 * giriş seçeneklerinden daha az belirgin olmamasını istiyor.
 *
 * Yalnızca `appleSignInAvailable()` true dönerse render edilmeli.
 */

type Props = {
  /** Erişilebilirlik etiketi; ekranda görünen metni Apple'ın kendisi yazıyor. */
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AppleSignInButton({ label, onPress, disabled = false, style }: Props) {
  const { themeName } = useTheme();

  return (
    // Başka bir sağlayıcı sürerken düğme basılamaz olmalı; ama sönükleştirmiyoruz:
    // Apple'ın düğmesinin görünümünü değiştirmek marka kurallarına giriyor,
    // dokunmayı engellemek girmiyor.
    <View style={style} pointerEvents={disabled ? 'none' : 'auto'}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        // Koyu temada beyaz, açık (parşömen) temada siyah düğme: ikisi de Apple'ın
        // hazır şemaları, ikisi de zeminle en yüksek kontrastı veriyor.
        buttonStyle={
          themeName === 'dark'
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={Radius.sm}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        // Ölçü verilmezse yerel düğme HİÇ çizilmiyor (Apple'ın dokümante ettiği davranış).
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: SOCIAL_BUTTON_HEIGHT,
  },
});
