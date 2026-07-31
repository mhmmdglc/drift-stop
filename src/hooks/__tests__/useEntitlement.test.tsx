/// <reference types="jest" />
const mockPurchases = {
  configured: true,
  loading: false,
  entitlementKnown: true,
  isPro: false,
  isAdsRemoved: false,
};

const mockTrial = {
  loaded: true,
  active: false,
  daysLeft: 0,
  dayIndex: -1,
  startedAt: null as number | null,
  endedNeedsNotice: false,
  acknowledgeEnded: () => {},
};

jest.mock('@/hooks/usePurchases', () => ({
  usePurchases: () => mockPurchases,
}));
jest.mock('@/hooks/useTrial', () => ({
  useTrial: () => mockTrial,
}));

import { renderHook } from '@testing-library/react-native';

import { useEntitlement } from '../useEntitlement';

beforeEach(() => {
  mockPurchases.configured = true;
  mockPurchases.entitlementKnown = true;
  mockPurchases.isPro = false;
  mockPurchases.isAdsRemoved = false;
  mockTrial.loaded = true;
  mockTrial.active = false;
  mockTrial.daysLeft = 0;
});

const read = async () => (await renderHook(() => useEntitlement())).result.current;

describe('useEntitlement', () => {
  it('abonelik hakkı varsa source abonelik olur', async () => {
    mockPurchases.isPro = true;
    const e = await read();
    expect(e.entitled).toBe(true);
    expect(e.source).toBe('subscription');
    expect(e.isSubscribed).toBe(true);
    expect(e.entitlementKnown).toBe(true);
  });

  it('aktif deneme hak verir ve kalan günü taşır', async () => {
    mockTrial.active = true;
    mockTrial.daysLeft = 4;
    const e = await read();
    expect(e.entitled).toBe(true);
    expect(e.source).toBe('trial');
    expect(e.trialDaysLeft).toBe(4);
    // Deneme abonelik DEĞİL: "zaten Pro'sun" metinleri buna bakıyor.
    expect(e.isSubscribed).toBe(false);
  });

  it('abonelik denemeyi bastırır — ödeme yapan kullanıcı deneme sayılmaz', async () => {
    mockPurchases.isPro = true;
    mockTrial.active = true;
    mockTrial.daysLeft = 2;
    const e = await read();
    expect(e.source).toBe('subscription');
    expect(e.trialDaysLeft).toBe(0);
  });

  it('RevenueCat yapılandırılmamışsa bile aktif deneme BİLİNEN bir haktır', async () => {
    // iOS'ta `appl_` anahtarı yok → configured false. Deneme tamamen yerel olduğu
    // için o platformda da çalışmalı; aksi halde deneme iOS'ta hiç başlamazdı.
    mockPurchases.configured = false;
    mockPurchases.entitlementKnown = false;
    mockTrial.active = true;
    mockTrial.daysLeft = 7;
    const e = await read();
    expect(e.entitled).toBe(true);
    expect(e.source).toBe('trial');
    expect(e.entitlementKnown).toBe(true);
  });

  it('deneme damgası daha okunmadıysa HİÇBİR ŞEY bilinmiyor', async () => {
    // EN KRİTİK KORUMA. `loaded` false iken "hak yok" demek, denemedeki
    // kullanıcının premium cache'ini her açılışın ilk anında silmek olurdu.
    mockTrial.loaded = false;
    const e = await read();
    expect(e.entitled).toBe(false);
    expect(e.entitlementKnown).toBe(false);
  });

  it('deneme bitti + abonelik yok = hak yok, ve bu BİLİNİYOR', async () => {
    mockTrial.active = false;
    const e = await read();
    expect(e.entitled).toBe(false);
    expect(e.source).toBe('none');
    expect(e.entitlementKnown).toBe(true);
  });

  it('deneme bitti ama RevenueCat cevap vermediyse karar VERİLEMEZ', async () => {
    // Deneme bitmiş olması "hak yok" demeye yetmez: kullanıcı abone olmuş olabilir
    // ve `customerInfo` henüz gelmemiş olabilir (çevrimdışı soğuk açılış).
    mockTrial.active = false;
    mockPurchases.entitlementKnown = false;
    const e = await read();
    expect(e.entitled).toBe(false);
    expect(e.entitlementKnown).toBe(false);
  });
});
