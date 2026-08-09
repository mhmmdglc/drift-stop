import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { PixelRatio, Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { WALLPAPER_EXPORT_HEIGHT, WALLPAPER_EXPORT_WIDTH } from '@/constants/wallpapers';

export type WallpaperResult =
  | { ok: true }
  | { ok: false; reason: 'permission' | 'error' };

/**
 * Geçici dosyanın adı — `MediaLibrary.Asset.create` dosya adını olduğu gibi
 * galeriye taşıyor. Vermezsek kullanıcı galerisinde kütüphanenin iç adını
 * ("ReactNative-snapshot-image2181370705585963514.png") görüyor.
 * Yalnızca Android'de etkili; iOS'ta seçenek yok sayılıyor, Fotoğraflar zaten
 * dosya adını göstermiyor. Android tarafı sonuna rastgele bir sayı ekliyor
 * (`File.createTempFile`), bu da aynı adın üzerine yazılmasını engelliyor.
 */
const CAPTURE_FILE_NAME = 'DriftStop-wallpaper';

/**
 * `captureRef`'in `width`/`height` birimi platforma göre değişiyor — tek bir
 * formül iki platformda birden doğru olmuyor:
 *
 * - **iOS** `rendererFormat.scale = 0` ("cihaz ölçeğini kullan") ile çiziyor
 *   (`RNViewShot.mm`), yani verilen sayılar **nokta**; çıktı piksel oranıyla
 *   çarpılıyor. 1080 vermek 3x'lik bir telefonda 3240 piksellik 11 MB'lık dosya
 *   üretiyordu, o yüzden orana bölünüyor.
 * - **Android** sayıyı hiç dokunmadan `Bitmap.createScaledBitmap`'e geçiriyor
 *   (`RNViewShotModule.java` → `ViewShot.java`); `DisplayMetrics` okunuyor ama
 *   kullanılmıyor. Yani birim **piksel**. Aynı bölmeyi burada da uygulamak
 *   2.625 yoğunluklu bir cihazda 1080 yerine 411 piksellik duvar kağıdı
 *   üretiyordu — 3.0'da 360'a kadar düşüyor.
 */
export function wallpaperCaptureSize(): { width: number; height: number } {
  const divisor = Platform.OS === 'android' ? 1 : PixelRatio.get();
  return {
    width: Math.round(WALLPAPER_EXPORT_WIDTH / divisor),
    height: Math.round(WALLPAPER_EXPORT_HEIGHT / divisor),
  };
}

/** Önizleme görünümünü duvar kağıdı çözünürlüğünde bir PNG'ye çevirir. */
export async function captureWallpaper(ref: RefObject<View | null>): Promise<string> {
  const { width, height } = wallpaperCaptureSize();
  return captureRef(ref, {
    format: 'png',
    quality: 1,
    width,
    height,
    fileName: CAPTURE_FILE_NAME,
    result: 'tmpfile',
  });
}

/**
 * Galeriye kaydeder. İzin reddedilirse 'permission' döner — çağıran taraf
 * kullanıcıya ayarlar yönlendirmesi gösterebilsin diye hata yutulmuyor.
 */
export async function saveWallpaperToLibrary(uri: string): Promise<WallpaperResult> {
  try {
    // Yalnızca yazma izni istiyoruz; galeriyi okumaya ihtiyacımız yok.
    const permission = await MediaLibrary.requestPermissionsAsync(true);
    if (!permission.granted) return { ok: false, reason: 'permission' };

    await MediaLibrary.Asset.create(uri);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** Sistem paylaşım sayfasını açar. Kaydetmeye alternatif, izin gerektirmiyor. */
export async function shareWallpaper(uri: string): Promise<WallpaperResult> {
  try {
    if (!(await Sharing.isAvailableAsync())) return { ok: false, reason: 'error' };
    await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
