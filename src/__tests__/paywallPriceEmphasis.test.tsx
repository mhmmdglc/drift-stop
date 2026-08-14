/// <reference types="jest" />

/**
 * Paywall fiyat hiyerarşisi.
 *
 * ⚠️ BU DOSYA BİR KEZ YANLIŞ KURALI SABİTLEDİ. Eskiden "haftalık rakam iki
 * satırda da en büyük olmalı" diye test ediyordu ve tam da bu düzen yüzünden
 * **1.2.0 (5) App Review'dan 3.1.2(c) ile reddedildi**:
 *
 *   "The auto-renewable subscription displays the weekly calculated pricing
 *    more clearly and conspicuously than the billed amount."
 *
 * Apple'ın şartı net: TAHSİL EDİLEN TUTAR ekrandaki en belirgin fiyat öğesi
 * olmalı; haftalık karşılık, indirim ve deneme dahil diğer her şey ona göre
 * ikincil KONUMDA ve BOYUTTA durmalı. Test artık bunu sabitliyor.
 */

jest.mock('react-native-purchases', () => ({
  PACKAGE_TYPE: {
    LIFETIME: 'LIFETIME',
    ANNUAL: 'ANNUAL',
    MONTHLY: 'MONTHLY',
    CUSTOM: 'CUSTOM',
  },
}));

const mockPurchase = jest.fn();

// `mock` öneki zorunlu: jest.mock fabrikası kapsam dışı değişkene sadece bu
// adlandırmayla erişebiliyor.
const mockPkg = (identifier: string, packageType: string, price: number, priceString: string) => ({
  identifier,
  packageType,
  product: { price, currencyCode: 'USD', priceString, title: identifier },
});

const mockAnnual = mockPkg('$rc_annual', 'ANNUAL', 35.99, '$35.99');
const mockMonthly = mockPkg('$rc_monthly', 'MONTHLY', 3.99, '$3.99');

jest.mock('@/hooks/usePurchases', () => ({
  usePurchases: () => ({
    configured: true,
    loading: false,
    offering: { availablePackages: [mockAnnual, mockMonthly] },
    purchasePackage: mockPurchase,
    restorePurchases: jest.fn(),
  }),
}));
jest.mock('@/hooks/useAuth', () => ({
  // Paywall artık oturum durumunu okuyor (misafire farklı satın alma onayı
  // veriliyor). Gerçek hook Supabase'i, o da expo-sqlite'ı çekiyor ve test
  // ortamında ayağa kalkmıyor — buradaki mesele kimlik değil, ekranın kendisi.
  useAuth: () => ({ user: null, configured: true }),
}));
jest.mock('@/hooks/useEntitlement', () => ({
  useEntitlement: () => ({
    entitled: false,
    source: 'none',
    trialDaysLeft: 0,
    entitlementKnown: true,
    purchasesConfigured: true,
    isSubscribed: false,
    isAdsRemoved: false,
  }),
}));
// Gerçek çeviri motoru kullanılıyor: sınanan şey ekrandaki asıl metin.
jest.mock('@/i18n/useTranslation', () => {
  const i18n = require('@/i18n').default;
  return {
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) => i18n.t(key, options),
      locale: 'en',
    }),
  };
});
jest.mock('@/hooks/use-theme', () => {
  const { DarkColors } = require('@/constants/colors');
  return { useTheme: () => ({ colors: DarkColors, themeName: 'dark', mode: 'dark' }) };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), canGoBack: () => true, push: jest.fn() }),
}));

import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import PaywallScreen from '@/app/paywall';
import i18n from '@/i18n';

function fontSizeOf(text: string): number {
  const flat = StyleSheet.flatten(screen.getByText(text).props.style) as { fontSize?: number };
  expect(flat.fontSize).toEqual(expect.any(Number));
  return flat.fontSize as number;
}

beforeAll(() => {
  i18n.locale = 'en';
});
afterAll(() => {
  i18n.locale = 'tr';
});

describe('renewal terms follow the store that actually bills', () => {
  // Apple metni Android'e giderse kullanıcıya var olmayan bir ekran tarif edilir
  // ("Settings → Apple Account → Subscriptions") ve iptal yolu yanlış anlatılmış
  // olur. İki mağaza da abonelik şartlarının doğru olmasını istiyor.
  it('names Google Play, not Apple, on Android', async () => {
    const { Platform } = require('react-native');
    const original = Platform.OS;
    Platform.OS = 'android';
    try {
      await render(<PaywallScreen />);
      expect(screen.getByText(/Google Play/)).toBeTruthy();
      expect(screen.queryByText(/Apple Account/)).toBeNull();
    } finally {
      Platform.OS = original;
    }
  });

  it('names the Apple Account on iOS', async () => {
    const { Platform } = require('react-native');
    const original = Platform.OS;
    Platform.OS = 'ios';
    try {
      await render(<PaywallScreen />);
      expect(screen.getByText(/Apple Account/)).toBeTruthy();
      expect(screen.queryByText(/Google Play/)).toBeNull();
    } finally {
      Platform.OS = original;
    }
  });
});

describe('paywall price emphasis', () => {
  it('makes the BILLED AMOUNT the biggest number on both rows', async () => {
    await render(<PaywallScreen />);
    // Reddin tam sebebi buydu; sıra tersine dönerse test kırılmalı.
    const annualBilled = fontSizeOf('$35.99 / year');
    const monthlyBilled = fontSizeOf('$3.99 / month');

    expect(fontSizeOf('≈ $0.69 / week')).toBeLessThan(annualBilled);
    expect(fontSizeOf('≈ $0.92 / week')).toBeLessThan(monthlyBilled);
  });

  it('keeps every other price element subordinate to the charge', async () => {
    await render(<PaywallScreen />);
    // Apple "diğer fiyat öğeleri ikincil boyutta" diyor — üstü çizili
    // karşılaştırma da haftalık karşılık da tahsilattan küçük kalmalı.
    const billed = fontSizeOf('$35.99 / year');
    expect(fontSizeOf('$47.88')).toBeLessThan(billed);
    expect(fontSizeOf('≈ $0.69 / week')).toBeLessThan(billed);
  });

  it('states the auto-renewal and cancellation terms inside the purchase flow', async () => {
    await render(<PaywallScreen />);
    // Reddin ikinci maddesi: sonraki dönemde ödemenin OTOMATİK başlayacağı
    // açık değildi. Metnin tamamını değil, taşıması gereken üç gerçeği sınıyoruz.
    const terms = screen.getByText(/renews automatically/i);
    expect(terms).toBeTruthy();
    expect(terms.props.children).toMatch(/cancel/i);
    expect(terms.props.children).toMatch(/24 hours/i);
  });

  it('offers a visible way to keep using the app without paying', async () => {
    await render(<PaywallScreen />);
    expect(screen.getByText('Continue with the free version')).toBeTruthy();
  });

  it('states the billing period next to every charged amount', async () => {
    await render(<PaywallScreen />);
    expect(screen.getByText('$35.99 / year')).toBeTruthy();
    expect(screen.getByText('$3.99 / month')).toBeTruthy();
    // Dönemsiz çıplak tutar ekranda olmamalı.
    expect(screen.queryByText('$35.99')).toBeNull();
    expect(screen.queryByText('$3.99')).toBeNull();
  });

  it('reads the real charge, its period and the weekly figure to a screen reader', async () => {
    await render(<PaywallScreen />);
    const annual = screen.getByLabelText(/Pro — Yearly/);
    expect(annual.props.accessibilityLabel).toContain('$35.99');
    expect(annual.props.accessibilityLabel).toContain('every year');
    expect(annual.props.accessibilityLabel).toContain('$0.69');
    // Sesli okuma da ekranla aynı sırayı izlemeli: önce tahsilat, sonra haftalık.
    expect(annual.props.accessibilityLabel.indexOf('$35.99')).toBeLessThan(
      annual.props.accessibilityLabel.indexOf('$0.69')
    );
    // Üstü çizili rakam ve indirim yüzdesi de sesli okumada geçmeli.
    expect(annual.props.accessibilityLabel).toContain('$47.88');
    expect(annual.props.accessibilityLabel).toContain('24%');

    const monthly = screen.getByLabelText(/Pro — Monthly/);
    expect(monthly.props.accessibilityLabel).toContain('$3.99');
    expect(monthly.props.accessibilityLabel).toContain('every month');
    expect(monthly.props.accessibilityLabel).toContain('$0.92');
  });
});
