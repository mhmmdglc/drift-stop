/// <reference types="jest" />
const mockPurchases = {
  configured: true,
  loading: false,
  entitlementKnown: true,
  isPro: false,
  isAdsRemoved: false,
};

// `useEntitlement` mocklanmıyor: bu hook'un asıl riski "abonelik + deneme"nin
// birleşimi, o yüzden gerçek birleştirici çalışsın.
const mockTrial = {
  loaded: true,
  active: false,
  daysLeft: 0,
  dayIndex: -1,
  startedAt: null as number | null,
  endedNeedsNotice: false,
  acknowledgeEnded: () => {},
};

const mockSettings: { settings: { frequency: number }; update: jest.Mock } = {
  settings: { frequency: 3 },
  update: jest.fn(),
};

jest.mock('@/hooks/usePurchases', () => ({
  usePurchases: () => mockPurchases,
}));
jest.mock('@/hooks/useTrial', () => ({
  useTrial: () => mockTrial,
}));
jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => mockSettings,
}));

import { renderHook } from '@testing-library/react-native';

import { useEnforceFreeLimits } from '../useEnforceFreeLimits';
import { FREE_FREQUENCY_MAX, FREQUENCY_OPTIONS, DEFAULT_SETTINGS } from '@/types/settings';

beforeEach(() => {
  jest.clearAllMocks();
  mockPurchases.configured = true;
  mockPurchases.loading = false;
  mockPurchases.entitlementKnown = true;
  mockPurchases.isPro = false;
  mockTrial.loaded = true;
  mockTrial.active = false;
  mockSettings.settings = { frequency: 3 };
});

describe('ücretsiz katman sınırı', () => {
  it('ücretsiz tavan 3 ve varsayılan da 3 — kullanıcı tavanda başlamamalı sanılabilir, kasıtlı olarak eşit', () => {
    // Bu ikisi bilerek eşit: ücretsiz kullanıcı en baştan sınırda oturuyor ki
    // 4. bildirimi isteyince duvara çarpsın. Eskiden ikisi de 5'ti ve o zaman da
    // eşitti — fark, artık üstünde ÜÇ Pro seçeneği olması (5/7/10), eskiden ikiydi.
    expect(FREE_FREQUENCY_MAX).toBe(3);
    expect(DEFAULT_SETTINGS.frequency).toBe(3);
  });

  it('3 üstündeki her seçenek Pro tarafında kalır', () => {
    const proOnly = FREQUENCY_OPTIONS.filter((f) => f > FREE_FREQUENCY_MAX);
    expect(proOnly).toEqual([5, 7, 10]);
  });
});

describe('useEnforceFreeLimits', () => {
  it('hak bitmiş kullanıcıyı ücretsiz tavana çeker', async () => {
    mockSettings.settings = { frequency: 10 };

    await renderHook(() => useEnforceFreeLimits());

    expect(mockSettings.update).toHaveBeenCalledWith({ frequency: FREE_FREQUENCY_MAX });
  });

  it('tavanı 5 sanan eski kurulumu da düşürür', async () => {
    // Sınır 5'ten 3'e indi. Daha önce 5 seçmiş bir kurulumda bu hook devreye
    // girmezse kullanıcı ücretsiz olarak 5 almaya devam eder — sessiz gelir kaçağı.
    mockSettings.settings = { frequency: 5 };

    await renderHook(() => useEnforceFreeLimits());

    expect(mockSettings.update).toHaveBeenCalledWith({ frequency: 3 });
  });

  it('zaten sınırın altındaysa dokunmaz', async () => {
    mockSettings.settings = { frequency: 3 };

    await renderHook(() => useEnforceFreeLimits());

    expect(mockSettings.update).not.toHaveBeenCalled();
  });

  it('Pro kullanıcıyı düşürmez', async () => {
    mockPurchases.isPro = true;
    mockSettings.settings = { frequency: 10 };

    await renderHook(() => useEnforceFreeLimits());

    expect(mockSettings.update).not.toHaveBeenCalled();
  });

  it('DENEMEDEKİ kullanıcıyı düşürmez — deneme "tam Pro" demek', async () => {
    // `isPro`ya bakan sürüm, denemedeki kullanıcının 10'a çektiği frekansı her
    // açılışta 3'e indirirdi: kullanıcı ayarı değiştirir, uygulama geri alır.
    mockTrial.active = true;
    mockTrial.daysLeft = 5;
    mockSettings.settings = { frequency: 10 };

    await renderHook(() => useEnforceFreeLimits());

    expect(mockSettings.update).not.toHaveBeenCalled();
  });

  it('deneme damgası daha okunmadıysa dokunmaz', async () => {
    mockTrial.loaded = false;
    mockSettings.settings = { frequency: 10 };

    await renderHook(() => useEnforceFreeLimits());

    expect(mockSettings.update).not.toHaveBeenCalled();
  });

  it('deneme bitince düşürür', async () => {
    mockTrial.loaded = true;
    mockTrial.active = false;
    mockSettings.settings = { frequency: 10 };

    await renderHook(() => useEnforceFreeLimits());

    expect(mockSettings.update).toHaveBeenCalledWith({ frequency: 3 });
  });

  it('hak bilgisi yüklenirken dokunmaz — gerçek Pro kullanıcı açılışta düşürülmemeli', async () => {
    mockPurchases.entitlementKnown = false;
    mockSettings.settings = { frequency: 10 };

    await renderHook(() => useEnforceFreeLimits());

    expect(mockSettings.update).not.toHaveBeenCalled();
  });

  it('satın almalar bu platformda kapalıysa hiç karışmaz', async () => {
    // iOS'ta RevenueCat anahtarı yokken tüm gate'ler kapalı; burada da
    // müdahale edersek kullanıcı sebepsiz yere 3'e düşürülür.
    mockPurchases.configured = false;
    mockSettings.settings = { frequency: 10 };

    await renderHook(() => useEnforceFreeLimits());

    expect(mockSettings.update).not.toHaveBeenCalled();
  });
});
