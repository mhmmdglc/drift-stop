/// <reference types="jest" />

/**
 * Paywall'daki hukuki bağlantılar.
 *
 * App Store 3.1.2, otomatik yenilenen abonelik satan bir uygulamanın
 * BINARY'sinin içinde hem gizlilik politikasına hem kullanım koşullarına
 * çalışan bir bağlantı bulundurmasını istiyor. Bu ekranda ikisi de yoktu ve
 * kullanım koşulları uygulamanın hiçbir yerinde yoktu — 1.2.0 gönderilmeden
 * hemen önce yakalandı.
 *
 * Bu dosyanın sabitlediği şey "bir yazı görünüyor" değil: yazıya basınca
 * GERÇEKTEN doğru URL'in açıldığı. Sadece metni sınayan bir test, onPress'i
 * boş bırakan bir refactor'ü fark etmezdi.
 */

jest.mock('react-native-purchases', () => ({
  PACKAGE_TYPE: { LIFETIME: 'LIFETIME', ANNUAL: 'ANNUAL', MONTHLY: 'MONTHLY', CUSTOM: 'CUSTOM' },
}));

const mockPkg = (identifier: string, packageType: string, price: number, priceString: string) => ({
  identifier,
  packageType,
  product: { price, currencyCode: 'USD', priceString, title: identifier },
});
const mockAnnual = mockPkg('$rc_annual', 'ANNUAL', 35.99, '$35.99');

jest.mock('@/hooks/usePurchases', () => ({
  usePurchases: () => ({
    configured: true,
    loading: false,
    offering: { availablePackages: [mockAnnual] },
    purchasePackage: jest.fn(),
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

import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';

import PaywallScreen from '@/app/paywall';
import { Links } from '@/constants/links';
import i18n from '@/i18n';

beforeAll(() => {
  i18n.locale = 'en';
});
afterAll(() => {
  i18n.locale = 'tr';
});

describe('paywall legal links', () => {
  it('shows a privacy policy link that opens the real policy', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await render(<PaywallScreen />);

    fireEvent.press(screen.getByText('Privacy Policy'));

    expect(open).toHaveBeenCalledWith('https://mgulcu.me/driftstop/privacy');
    open.mockRestore();
  });

  it("shows a terms of use link on iOS that opens Apple's standard EULA", async () => {
    // Jest'te `Platform.OS` 'ios' — yani ölçtüğümüz dal mağazaya giden dal.
    expect(Platform.OS).toBe('ios');
    expect(Links.termsOfUse).toBe(
      'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'
    );

    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await render(<PaywallScreen />);

    fireEvent.press(screen.getByText('Terms of Use'));

    expect(open).toHaveBeenCalledWith(Links.termsOfUse);
    open.mockRestore();
  });

  it('keeps both links reachable by a screen reader', async () => {
    await render(<PaywallScreen />);
    expect(screen.getByLabelText('Privacy Policy')).toBeTruthy();
    expect(screen.getByLabelText('Terms of Use')).toBeTruthy();
  });

  // App Review 1.2.0 (6) reddi (iPad, Guideline 2.1(a), 2026-08-17): "Unable to scroll
  // up the Go pro page to access privacy policy and term of Use." Ekranın hiç kaydırma
  // konteyneri yoktu; RNTL gerçek viewport/kaydırma ölçmediği için yukarıdaki testler
  // (linkler AĞAÇTA var mı) bunu hiç yakalayamazdı — bu test en azından yapısal
  // garantiyi (bir ScrollView var mı) sabitliyor.
  it('wraps the screen in a ScrollView so overflowing content stays reachable', async () => {
    await render(<PaywallScreen />);
    expect(screen.getByTestId('paywallScroll')).toBeTruthy();
  });
});
