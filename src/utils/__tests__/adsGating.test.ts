/// <reference types="jest" />
/**
 * Geçiş reklamının zaman kapıları. Saf fonksiyon olarak ayrıldı çünkü asıl hata
 * gözle görülmüyordu: iki ayrı kavram (açılış payı ve reklamlar arası aralık)
 * tek bir değişkende toplanmıştı ve sonuç "reklam hiç çıkmıyor"du — hiçbir yerde
 * hata vermeden.
 */
jest.mock('react-native-google-mobile-ads', () => ({
  __esModule: true,
  default: () => ({ initialize: jest.fn().mockResolvedValue(undefined) }),
  BannerAd: () => null,
  BannerAdSize: {},
  InterstitialAd: { createForAdRequest: jest.fn() },
  AdEventType: { LOADED: 'loaded', CLOSED: 'closed', ERROR: 'error' },
  TestIds: { BANNER: 'b', INTERSTITIAL: 'i' },
}));
jest.mock('expo-tracking-transparency', () => ({
  requestTrackingPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
  getTrackingPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
}));

import { isInterstitialTimeAllowed } from '../ads';

const MIN = 60 * 1000;
const NOW = 1_800_000_000_000;

describe('isInterstitialTimeAllowed', () => {
  it('açılıştan hemen sonra göstermez', () => {
    expect(isInterstitialTimeAllowed(NOW, NOW - 5 * 1000, 0)).toBe(false);
  });

  it('açılış payı dolunca ve hiç reklam gösterilmediyse izin verir', () => {
    // ESKİ DAVRANIŞ BUYDU VE YANLIŞTI: `initAds` `lastShownAt`i açılış anına
    // yazdığı için 4 DAKİKA boyunca hiçbir reklam çıkmıyordu; 12 kaydırma
    // eşiğiyle birleşince tipik oturumda hiç çıkmıyordu.
    expect(isInterstitialTimeAllowed(NOW, NOW - 90 * 1000, 0)).toBe(true);
  });

  it('son reklamdan hemen sonra göstermez', () => {
    expect(isInterstitialTimeAllowed(NOW, NOW - 30 * MIN, NOW - 60 * 1000)).toBe(false);
  });

  it('reklamlar arası 4 dakika dolunca izin verir', () => {
    expect(isInterstitialTimeAllowed(NOW, NOW - 30 * MIN, NOW - 5 * MIN)).toBe(true);
  });

  it('açılış payı ve reklam aralığı AYRI kapılar — biri dolsa da diğeri bloklar', () => {
    // Uygulama yeni açıldı ama önceki oturumdan kalma bir "son gösterim" varmış
    // gibi davranılmamalı: açılış payı tek başına yeter.
    expect(isInterstitialTimeAllowed(NOW, NOW - 10 * 1000, NOW - 30 * MIN)).toBe(false);
  });

  it('henüz init edilmediyse (started 0) açılış payı uygulanmaz', () => {
    expect(isInterstitialTimeAllowed(NOW, 0, 0)).toBe(true);
  });
});
