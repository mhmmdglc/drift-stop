/// <reference types="jest" />
import {
  DEFAULT_WALLPAPER_STYLE,
  WALLPAPER_EXPORT_HEIGHT,
  WALLPAPER_EXPORT_WIDTH,
  WALLPAPER_STYLES,
  getWallpaperStyle,
  wallpaperQuoteFontSize,
} from '@/constants/wallpapers';

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(),
  Asset: { create: jest.fn() },
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn() }));

import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

import { PixelRatio, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { captureWallpaper, saveWallpaperToLibrary, shareWallpaper } from '@/utils/wallpaper';

const mockedCapture = captureRef as jest.MockedFunction<typeof captureRef>;

const mockedMedia = MediaLibrary as jest.Mocked<typeof MediaLibrary>;
const mockedSharing = Sharing as jest.Mocked<typeof Sharing>;
// `Asset.create` statik bir metot; jest.Mocked onu sarmıyor, elle daraltıyoruz.
const createAsset = MediaLibrary.Asset.create as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  // `Platform.OS` ve `PixelRatio.get` yerine konuyor; sızdırırsa sonraki
  // testler yanlış platformda çalışır.
  jest.restoreAllMocks();
});

/** captureRef'e giden seçenekler — her testte aynı daraltma tekrarlanmasın. */
function captureOptions() {
  return mockedCapture.mock.calls[0][1] as { width: number; height: number; fileName?: string };
}

describe('wallpaper styles', () => {
  it('every style has a unique id', () => {
    const ids = WALLPAPER_STYLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('offers the four-to-five choices the product promises', () => {
    expect(WALLPAPER_STYLES.length).toBeGreaterThanOrEqual(4);
    expect(WALLPAPER_STYLES.length).toBeLessThanOrEqual(6);
  });

  it('defines every colour a canvas needs, as hex', () => {
    for (const s of WALLPAPER_STYLES) {
      for (const value of [s.text, s.muted, s.accent, s.line, ...s.gradient]) {
        expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it('never renders text in the same colour as its backdrop', () => {
    for (const s of WALLPAPER_STYLES) {
      expect(s.text.toLowerCase()).not.toBe(s.gradient[0].toLowerCase());
      expect(s.text.toLowerCase()).not.toBe(s.gradient[1].toLowerCase());
    }
  });

  it('keeps speckles off the light backdrop, where they would be invisible', () => {
    const parchment = getWallpaperStyle('parchment');
    expect(parchment.speckles).toBe(false);
  });

  it('falls back to the default for an unknown or missing id', () => {
    expect(getWallpaperStyle('does-not-exist')).toBe(DEFAULT_WALLPAPER_STYLE);
    expect(getWallpaperStyle(undefined)).toBe(DEFAULT_WALLPAPER_STYLE);
  });

  it('exports at a portrait phone resolution', () => {
    expect(WALLPAPER_EXPORT_WIDTH).toBe(1080);
    expect(WALLPAPER_EXPORT_HEIGHT).toBeGreaterThan(WALLPAPER_EXPORT_WIDTH);
  });

  it('shrinks the quote body as the quote gets longer', () => {
    const sizes = [40, 120, 170, 220, 400].map(wallpaperQuoteFontSize);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeLessThan(sizes[i - 1]);
    }
  });

  it('shrinks the longest bundled quote (203 chars) well below the base size', () => {
    // Herakleitos (id 892) sabit 78 puntoda 11 satıra çıkıp imzayla çakışıyordu.
    expect(wallpaperQuoteFontSize(203)).toBeLessThan(wallpaperQuoteFontSize(40) * 0.75);
  });
});

describe('captureWallpaper', () => {
  // iOS `rendererFormat.scale = 0` ile çiziyor: verilen sayılar NOKTA, çıktı
  // piksel oranıyla çarpılıyor. Bölmeyi atlayınca 3x'lik bir telefonda
  // 3240×7020, 11 MB'lık dosya çıkıyordu.
  it.each([1, 2, 3])('asks iOS for points at a %sx pixel ratio', async (ratio) => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    jest.spyOn(PixelRatio, 'get').mockReturnValue(ratio);
    mockedCapture.mockResolvedValue('file:///tmp/a.png');

    await captureWallpaper({ current: null });

    expect(captureOptions().width * ratio).toBe(WALLPAPER_EXPORT_WIDTH);
    expect(captureOptions().height * ratio).toBe(WALLPAPER_EXPORT_HEIGHT);
  });

  // Android aynı sayıyı doğrudan Bitmap.createScaledBitmap'e veriyor: birim
  // PİKSEL. iOS'un bölmesini burada da uygulamak 2.625 yoğunluklu emülatörde
  // 411×891'lik (85 KB) bir duvar kağıdı üretiyordu.
  it.each([1, 2, 2.625, 3])(
    'asks Android for raw pixels at a %sx pixel ratio',
    async (ratio) => {
      jest.replaceProperty(Platform, 'OS', 'android');
      jest.spyOn(PixelRatio, 'get').mockReturnValue(ratio);
      mockedCapture.mockResolvedValue('file:///tmp/a.png');

      await captureWallpaper({ current: null });

      expect(captureOptions().width).toBe(WALLPAPER_EXPORT_WIDTH);
      expect(captureOptions().height).toBe(WALLPAPER_EXPORT_HEIGHT);
    }
  );

  it('writes a png to a temp file', async () => {
    jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
    mockedCapture.mockResolvedValue('file:///tmp/a.png');

    await captureWallpaper({ current: null });

    expect(mockedCapture.mock.calls[0][1]).toEqual(
      expect.objectContaining({ format: 'png', result: 'tmpfile' })
    );
  });

  // Ad verilmezse galeriye "ReactNative-snapshot-image21813707…png" olarak düşüyor.
  it('names the temp file after the app, not after the capture library', async () => {
    jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
    mockedCapture.mockResolvedValue('file:///tmp/a.png');

    await captureWallpaper({ current: null });

    expect(captureOptions().fileName).toMatch(/^DriftStop/);
    // Android tarafı File.createTempFile ile kullanıyor; ön ek en az 3 karakter olmalı.
    expect(captureOptions().fileName!.length).toBeGreaterThanOrEqual(3);
  });
});

describe('saveWallpaperToLibrary', () => {
  it('asks for write-only permission — reading the library is not needed', async () => {
    mockedMedia.requestPermissionsAsync.mockResolvedValue({ granted: true } as never);
    createAsset.mockResolvedValue({} as never);

    await saveWallpaperToLibrary('file:///tmp/a.png');

    expect(mockedMedia.requestPermissionsAsync).toHaveBeenCalledWith(true);
  });

  it('saves the captured file when permission is granted', async () => {
    mockedMedia.requestPermissionsAsync.mockResolvedValue({ granted: true } as never);
    createAsset.mockResolvedValue({} as never);

    await expect(saveWallpaperToLibrary('file:///tmp/a.png')).resolves.toEqual({ ok: true });
    expect(createAsset).toHaveBeenCalledWith('file:///tmp/a.png');
  });

  it('reports a denied permission distinctly, so the UI can point at Settings', async () => {
    mockedMedia.requestPermissionsAsync.mockResolvedValue({ granted: false } as never);

    await expect(saveWallpaperToLibrary('file:///tmp/a.png')).resolves.toEqual({
      ok: false,
      reason: 'permission',
    });
    expect(createAsset).not.toHaveBeenCalled();
  });

  it('does not throw when the media library fails', async () => {
    mockedMedia.requestPermissionsAsync.mockResolvedValue({ granted: true } as never);
    createAsset.mockRejectedValue(new Error('disk full'));

    await expect(saveWallpaperToLibrary('file:///tmp/a.png')).resolves.toEqual({
      ok: false,
      reason: 'error',
    });
  });
});

describe('shareWallpaper', () => {
  it('shares the file as a PNG', async () => {
    mockedSharing.isAvailableAsync.mockResolvedValue(true);
    mockedSharing.shareAsync.mockResolvedValue(undefined as never);

    await expect(shareWallpaper('file:///tmp/a.png')).resolves.toEqual({ ok: true });
    expect(mockedSharing.shareAsync).toHaveBeenCalledWith(
      'file:///tmp/a.png',
      expect.objectContaining({ mimeType: 'image/png' })
    );
  });

  it('fails cleanly where sharing is unavailable', async () => {
    mockedSharing.isAvailableAsync.mockResolvedValue(false);

    await expect(shareWallpaper('file:///tmp/a.png')).resolves.toEqual({
      ok: false,
      reason: 'error',
    });
    expect(mockedSharing.shareAsync).not.toHaveBeenCalled();
  });

  it('treats a cancelled share as a handled failure, not a crash', async () => {
    mockedSharing.isAvailableAsync.mockResolvedValue(true);
    mockedSharing.shareAsync.mockRejectedValue(new Error('cancelled'));

    await expect(shareWallpaper('file:///tmp/a.png')).resolves.toEqual({
      ok: false,
      reason: 'error',
    });
  });
});
