/**
 * Tipografi — el yazısı her yerde.
 * Caveat: tüm söz metinleri. Kalam: yazar/etiketler/ayarlar. Architects Daughter: başlıklar/uygulama adı.
 *
 * Font ailesi isimleri @expo-google-fonts paketlerinin export ettiği anahtarlarla birebir aynı olmalı
 * (root layout'ta useFonts ile yüklenir).
 */

export const Fonts = {
  quote: 'Caveat_400Regular',
  quoteBold: 'Caveat_700Bold',
  body: 'Kalam_400Regular',
  bodyBold: 'Kalam_700Bold',
  display: 'ArchitectsDaughter_400Regular',
} as const;

export const FontSizes = {
  quote: 28, // 26–30
  quoteLarge: 32,
  author: 16,
  label: 13,
  title: 36, // uygulama adı
  heading: 22,
  body: 15,
} as const;

export const Typography = {
  letterSpacing: 1,
  lineHeightRatio: 1.6,
} as const;
