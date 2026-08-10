/// <reference types="jest" />

/**
 * Paywall fiyat hiyerarşisi.
 *
 * Vurgu bilinçli olarak haftalık karşılıkta: en büyük rakam "haftada $0.69".
 * Bu düzenin tek riski, gerçekten tahsil edilen tutarın kaybolması — App Store
 * 3.1.2 ve Play abonelik politikası tutarın ve dönemin açıkça yazılmasını
 * istiyor, ve bu ekran bu yüzden bir kez reddedildi. Bu dosya üç şeyi sabitler:
 * haftalık rakam gerçekten daha büyük, tahsil edilen tutar dönemiyle EKRANDA,
 * ve ekran okuyucu da aynı gerçeği duyuyor.
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

describe('paywall price emphasis', () => {
  it('makes the per-week figure the biggest number on both rows', async () => {
    await render(<PaywallScreen />);
    // 35.99 / 52 ve 3.99 * 12 / 52 — ikisi de mağaza fiyatından türetiliyor.
    const annualWeekly = fontSizeOf('$0.69');
    const monthlyWeekly = fontSizeOf('$0.92');

    expect(fontSizeOf('$35.99 / year')).toBeLessThan(annualWeekly);
    expect(fontSizeOf('$3.99 / month')).toBeLessThan(monthlyWeekly);
  });

  it('keeps the charged amount legible rather than tiny', async () => {
    await render(<PaywallScreen />);
    // "Küçük" demek "okunmaz" demek değil: tahsilat satırı gövde metniyle aynı
    // boyda kalmalı, üstü çizili karşılaştırmadan (etiket boyu) küçük olmamalı.
    const billed = fontSizeOf('$35.99 / year');
    expect(billed).toBeGreaterThanOrEqual(fontSizeOf('$47.88'));
    expect(billed / fontSizeOf('$0.69')).toBeGreaterThan(0.5);
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
    // Üstü çizili rakam ve indirim yüzdesi de sesli okumada geçmeli.
    expect(annual.props.accessibilityLabel).toContain('$47.88');
    expect(annual.props.accessibilityLabel).toContain('24%');

    const monthly = screen.getByLabelText(/Pro — Monthly/);
    expect(monthly.props.accessibilityLabel).toContain('$3.99');
    expect(monthly.props.accessibilityLabel).toContain('every month');
    expect(monthly.props.accessibilityLabel).toContain('$0.92');
  });
});
