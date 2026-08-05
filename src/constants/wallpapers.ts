/**
 * Duvar kağıdı arka planları.
 *
 * Stok fotoğraf yerine kodla çiziliyor: paket boyutu şişmiyor, lisans derdi yok
 * ve uygulamanın el çizimi/kağıt diliyle aynı yerde duruyor. Her biri iki renkli
 * bir gradyan + üzerine düşen mürekkep tonlarından ibaret; okunabilirlik için
 * metin rengi arka planla birlikte tanımlanıyor (kontrast tesadüfe bırakılmıyor).
 */

export type WallpaperStyle = {
  id: string;
  /** i18n anahtarı: wallpaper.styles.<id> */
  gradient: [string, string];
  /** Gradyan açısı — 0 = üstten alta, 45 = köşeden köşeye. */
  angle: number;
  text: string;
  muted: string;
  accent: string;
  /** Kağıt çizgileri ve yıldız serpintisi bu tonda çiziliyor. */
  line: string;
  /** Açık zeminlerde yıldızlar görünmez; serpinti bu bayrakla kapanıyor. */
  speckles: boolean;
};

export const WALLPAPER_STYLES: readonly WallpaperStyle[] = [
  {
    // Uygulamanın kendi kimliği — mum ışığında koyu kahve.
    id: 'ember',
    gradient: ['#241F18', '#12100C'],
    angle: 20,
    text: '#F0EAD6',
    muted: '#9C9075',
    accent: '#C8923A',
    line: '#3A3528',
    speckles: true,
  },
  {
    // Şafak: sıcak amberden kızıla; sabah bildirimleriyle iyi gidiyor.
    id: 'dawn',
    gradient: ['#8A4B22', '#2A1408'],
    angle: 35,
    text: '#FBEFD8',
    muted: '#D9B48A',
    accent: '#F0C070',
    line: '#5B2F14',
    speckles: true,
  },
  {
    // Parşömen: açık zemin, koyu mürekkep. Aydınlık ekran sevenler için.
    id: 'parchment',
    gradient: ['#F4EEDA', '#DED4B4'],
    angle: 15,
    text: '#221E18',
    muted: '#6B6152',
    accent: '#A6722A',
    line: '#CFC4A2',
    speckles: false,
  },
  {
    // Gece: derin mürekkep mavisi-moru; yıldız serpintisi burada en belirgin.
    id: 'midnight',
    gradient: ['#1B2340', '#0A0D18'],
    angle: 25,
    text: '#E6E9F5',
    muted: '#8B93AE',
    accent: '#9FB4E8',
    line: '#2A3455',
    speckles: true,
  },
  {
    // Kor: sönmüş ateş kırmızısı. Disiplin/direnç temalı sözlerle güçlü duruyor.
    id: 'kindling',
    gradient: ['#4A1A14', '#160806'],
    angle: 30,
    text: '#F6E3DA',
    muted: '#C0907F',
    accent: '#E0714F',
    line: '#5E2318',
    speckles: true,
  },
] as const;

export const DEFAULT_WALLPAPER_STYLE = WALLPAPER_STYLES[0];

export function getWallpaperStyle(id: string | undefined): WallpaperStyle {
  return WALLPAPER_STYLES.find((s) => s.id === id) ?? DEFAULT_WALLPAPER_STYLE;
}

/**
 * Telefon duvar kağıdı oranı. 1080×2340 (9:19.5) çoğu modern telefonda
 * kırpılmadan oturuyor; daha uzun ekranlarda üst/alt hafif kırpılır, ki
 * tasarım zaten ortada toplanıyor.
 */
export const WALLPAPER_ASPECT = 2340 / 1080;
export const WALLPAPER_EXPORT_WIDTH = 1080;
export const WALLPAPER_EXPORT_HEIGHT = 2340;
