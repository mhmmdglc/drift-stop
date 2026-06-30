/**
 * DriftStop renk paleti — "mum ışığında eski deri defter" hissi.
 * Mavi yok, kurumsal gri-beyaz yok. Sıcak kahve / amber / kömür.
 */

export type ThemeColors = {
  background: string;
  surface: string;
  paperTint: string;
  text: string;
  textMuted: string;
  accent: string;
  fire: string;
  faintLine: string;
};

export type ColorKey = keyof ThemeColors;

export const DarkColors: ThemeColors = {
  background: '#1C1A16', // çok koyu sıcak kahve
  surface: '#252218', // kart arka planı
  paperTint: '#2E2A1F', // katmanlama
  text: '#F0EAD6', // eskimiş kağıt beyazı
  textMuted: '#9C9075', // solmuş mürekkep
  accent: '#C8923A', // mum alevi amber
  fire: '#C4503A', // kurumuş kırmızı mürekkep
  faintLine: '#3A3528', // defter çizgileri / kenarlar
};

export const LightColors: ThemeColors = {
  background: '#F2EDD8', // eskimiş parşömen
  surface: '#EDE7CC',
  paperTint: '#E7E0C2',
  text: '#1C1A16', // koyu kömür
  textMuted: '#7A7060', // solmuş kurşun kalem
  accent: '#A6722A', // amber mürekkep
  fire: '#A8402A', // eski kırmızı mürekkep
  faintLine: '#D8D0B4',
};

export const Palettes = {
  dark: DarkColors,
  light: LightColors,
} as const;

export type ThemeName = keyof typeof Palettes;
