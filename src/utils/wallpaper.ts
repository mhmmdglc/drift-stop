import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { PixelRatio, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { WALLPAPER_EXPORT_HEIGHT, WALLPAPER_EXPORT_WIDTH } from '@/constants/wallpapers';

export type WallpaperResult =
  | { ok: true }
  | { ok: false; reason: 'permission' | 'error' };

/**
 * Önizleme görünümünü duvar kağıdı çözünürlüğünde bir PNG'ye çevirir.
 *
 * ⚠️ `captureRef`'in `width`/`height` değerleri **nokta** cinsinden ve çıktı
 * cihazın piksel oranıyla çarpılıyor. Doğrudan 1080×2340 vermek 3x'lik bir
 * telefonda 3240×7020'lik 11 MB'lık bir dosya üretiyordu; hedef pikseli
 * orana bölmek gerekiyor.
 */
export async function captureWallpaper(ref: RefObject<View | null>): Promise<string> {
  const ratio = PixelRatio.get();
  return captureRef(ref, {
    format: 'png',
    quality: 1,
    width: WALLPAPER_EXPORT_WIDTH / ratio,
    height: WALLPAPER_EXPORT_HEIGHT / ratio,
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
