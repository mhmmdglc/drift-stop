import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Radius, Spacing } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';

/**
 * Google ile giriş düğmesi.
 *
 * Uygulamanın geri kalanı el çizimi (`SketchButton`) ama bu düğme öyle olamaz:
 * Google'ın marka kuralları resmi "G" işaretini, onaylı metni ve onaylı renk /
 * kenarlık şemasını zorunlu tutuyor. Bu yüzden burada `WobblyBorder` yok, düz
 * bir yüzey var; ekranla uyum yalnızca ölçü, köşe yarıçapı ve boşluklardan
 * geliyor. Basınca uygulanan mürekkep-damgası ölçek animasyonu ise korunuyor —
 * o markayı değiştirmiyor.
 */

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Giriş sürerken: düğme sönük ve basılamaz, ama işaret asla solmaz. */
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Google'ın resmi dört renkli "G" işareti. Yeniden çizilemez, renklendirilemez, soldurulamaz. */
export function GoogleGlyph({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Path
        fill="#4285F4"
        d="M17.64 9.20455c0-.63864-.05727-1.25182-.16364-1.84091H9v3.48136h4.84364c-.20864 1.125-.84273 2.07818-1.79591 2.71636v2.25818h2.90864c1.70182-1.56682 2.68364-3.87409 2.68364-6.61499z"
      />
      <Path
        fill="#34A853"
        d="M9 18c2.43 0 4.46727-.80591 5.95636-2.18045l-2.90864-2.25818c-.80591.54-1.83682.85909-3.04772.85909-2.34409 0-4.32818-1.58318-5.03591-3.71045H.957273v2.33182C2.43818 15.9832 5.48182 18 9 18z"
      />
      <Path
        fill="#FBBC05"
        d="M3.96409 10.71c-.18-.54-.28227-1.11682-.28227-1.71s.10227-1.17.28227-1.71V4.95818H.957273C.347727 6.17318 0 7.54773 0 9s.347727 2.82682.957273 4.04182L3.96409 10.71z"
      />
      <Path
        fill="#EA4335"
        d="M9 3.57955c1.32136 0 2.50773.45409 3.44046 1.34591l2.58135-2.58136C13.4632.891818 11.4259 0 9 0 5.48182 0 2.43818 2.01682.957273 4.95818L3.96409 7.29C4.67182 5.16273 6.656 3.57955 9 3.57955z"
      />
    </Svg>
  );
}

export function GoogleSignInButton({ label, onPress, disabled = false, busy = false, style }: Props) {
  const { themeName } = useTheme();
  const inactive = disabled || busy;
  // Google'ın onayladığı iki şema: açık zeminde beyaz, koyu zeminde koyu.
  const surface = themeName === 'dark' ? DARK_SURFACE : LIGHT_SURFACE;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      hitSlop={8}
      style={[styles.btn, style]}>
      {({ pressed }) => (
        <>
          {/* Yüzey ayrı bir katman: sönükleştirme yalnızca ona ve etikete
              uygulanıyor, "G" işareti hiçbir durumda solmuyor (Google marka kuralı). */}
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.surface,
              { backgroundColor: surface.background, borderColor: surface.border },
              pressed && styles.pressed,
              inactive && styles.faded,
            ]}
          />
          <GoogleGlyph size={18} />
          <Text
            numberOfLines={1}
            style={[styles.label, { color: surface.text }, inactive && styles.faded]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Google'ın onayladığı iki yüzey; renkler marka kılavuzundan, temadan türetilmiyor. */
const LIGHT_SURFACE = { background: '#FFFFFF', border: '#747775', text: '#1F1F1F' } as const;
const DARK_SURFACE = { background: '#131314', border: '#8E918F', text: '#E3E3E3' } as const;

/** Apple'ın yerel düğmesiyle aynı yükseklik: hiçbiri diğerinden baskın görünmemeli. */
export const SOCIAL_BUTTON_HEIGHT = 48;

const styles = StyleSheet.create({
  btn: {
    height: SOCIAL_BUTTON_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm + 4,
    paddingHorizontal: Spacing.md,
  },
  surface: {
    borderWidth: 1,
    borderRadius: Radius.sm,
  },
  // Google metinde Roboto istiyor; uygulamanın el yazısı fontları burada
  // kullanılamaz. Sistem fontu Android'de zaten Roboto — bu yüzden `ThemedText`
  // değil, düz `Text`.
  label: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  pressed: {
    opacity: 0.85,
  },
  faded: {
    opacity: 0.4,
  },
});
