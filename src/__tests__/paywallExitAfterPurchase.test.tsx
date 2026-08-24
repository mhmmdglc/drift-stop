/// <reference types="jest" />

/**
 * Satın aldıktan sonra paywall'dan çıkabilmek.
 *
 * iOS 1.2.0 (build 8) **App Review'dan Guideline 4 ile reddedildi**:
 *
 *   "After we make a successful purchase… there is no option to leave the
 *    purchase screen unless tapping on Maybe Later or Continue with the free
 *    version, unless user closes the app."
 *
 * `buy()` başarıda yalnızca bir mesaj gösteriyordu, hiçbir yere gitmiyordu; geriye
 * kalan iki çıkış da **parasını ödemiş** birine "belki sonra" / "ücretsiz sürümle
 * devam et" diyordu. Bu ekran üç kez reddedildi ve her seferinde testler yeşildi —
 * bu dosyanın var olma sebebi o.
 */

jest.mock('react-native-purchases', () => ({
  PACKAGE_TYPE: {
    LIFETIME: 'LIFETIME',
    ANNUAL: 'ANNUAL',
    MONTHLY: 'MONTHLY',
    CUSTOM: 'CUSTOM',
  },
}));

// `mock` öneki zorunlu: jest.mock fabrikası kapsam dışı değişkene sadece bu
// adlandırmayla erişebiliyor.
const mockPurchase = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockEntitlement = {
  entitled: false,
  source: 'none',
  trialDaysLeft: 0,
  entitlementKnown: true,
  purchasesConfigured: true,
  isSubscribed: false,
  isAdsRemoved: false,
};
const mockAuth = { user: null as { id: string } | null, configured: true };

const mockPkg = (identifier: string, packageType: string, price: number, priceString: string) => ({
  identifier,
  packageType,
  product: { price, currencyCode: 'USD', priceString, title: identifier },
});

const mockAnnual = mockPkg('$rc_annual', 'ANNUAL', 35.99, '$35.99');
const mockMonthly = mockPkg('$rc_monthly', 'MONTHLY', 3.99, '$3.99');
const mockLifetime = mockPkg('$rc_lifetime', 'LIFETIME', 9.99, '$9.99');

jest.mock('@/hooks/usePurchases', () => ({
  usePurchases: () => ({
    configured: true,
    loading: false,
    offering: { availablePackages: [mockAnnual, mockMonthly, mockLifetime] },
    purchasePackage: mockPurchase,
    restorePurchases: jest.fn(),
  }),
}));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => mockAuth }));
jest.mock('@/hooks/useEntitlement', () => ({ useEntitlement: () => mockEntitlement }));
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
  useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: mockCanGoBack, push: jest.fn() }),
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import PaywallScreen from '@/app/paywall';
import i18n from '@/i18n';

const DONE = 'Continue to the app';
const FREE = 'Continue with the free version';

async function buy(label: string) {
  fireEvent.press(screen.getByLabelText(new RegExp(label)));
  await waitFor(() => expect(screen.getByLabelText(DONE)).toBeTruthy());
}

beforeAll(() => {
  i18n.locale = 'en';
});
afterAll(() => {
  i18n.locale = 'tr';
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
  mockEntitlement.isSubscribed = false;
  mockEntitlement.isAdsRemoved = false;
  mockAuth.user = null;
  mockPurchase.mockResolvedValue({ cancelled: false, error: null });
});

describe('leaving the paywall after a successful purchase', () => {
  it('shows an exit that actually closes the screen', async () => {
    await render(<PaywallScreen />);
    // Satın almadan ÖNCE böyle bir düğme yok; reddin sebebi de zaten buydu.
    expect(screen.queryByLabelText(DONE)).toBeNull();

    await buy('Pro — Yearly');

    fireEvent.press(screen.getByLabelText(DONE));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('falls back to the root when there is nothing to go back to', async () => {
    // Paywall onboarding'den doğrudan açılabiliyor; `back()` boş yığında
    // hiçbir şey yapmaz ve kullanıcı yine ekranda kalırdı.
    mockCanGoBack.mockReturnValue(false);
    await render(<PaywallScreen />);
    await buy('Pro — Yearly');

    fireEvent.press(screen.getByLabelText(DONE));
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('stops calling the buyer a free user', async () => {
    await render(<PaywallScreen />);
    expect(screen.getByText(FREE)).toBeTruthy();
    expect(screen.getByText('Maybe later')).toBeTruthy();

    await buy('Pro — Yearly');

    // Denetçinin cümlesi: çıkış olarak yalnız "Maybe Later" ve "Continue with
    // the free version" vardı — ikisi de ödeme yapmış kullanıcı için yanlış.
    expect(screen.queryByText(FREE)).toBeNull();
    expect(screen.queryByText('Maybe later')).toBeNull();
    expect(screen.getByText('Close')).toBeTruthy();
  });

  it('keeps the purchase confirmation on screen instead of navigating away', async () => {
    // Misafirin onayı ("giriş yap ki premium koleksiyonlar insin") tam da bu
    // ekranda gösteriliyor; otomatik kapanma onu okunmadan yok ederdi.
    await render(<PaywallScreen />);
    await buy('Pro — Yearly');

    expect(screen.getByText(/Sign in so your premium collections/)).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('gives the one-off ads-removal purchase the same exit', async () => {
    await render(<PaywallScreen />);
    await buy('Remove ads');

    expect(screen.getByText(/Ads are now off/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText(DONE));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('the exit does not appear where it should not', () => {
  it('leaves the free exit alone when the purchase is cancelled', async () => {
    mockPurchase.mockResolvedValue({ cancelled: true, error: null });
    await render(<PaywallScreen />);

    fireEvent.press(screen.getByLabelText(/Pro — Yearly/));
    await waitFor(() => expect(mockPurchase).toHaveBeenCalled());

    expect(screen.queryByLabelText(DONE)).toBeNull();
    expect(screen.getByText(FREE)).toBeTruthy();
  });

  it('leaves the free exit alone when the purchase fails', async () => {
    mockPurchase.mockResolvedValue({ cancelled: false, error: new Error('nope') });
    await render(<PaywallScreen />);

    fireEvent.press(screen.getByLabelText(/Pro — Yearly/));
    await waitFor(() => expect(screen.getByText(/went wrong|try again/i)).toBeTruthy());

    expect(screen.queryByLabelText(DONE)).toBeNull();
    expect(screen.getByText(FREE)).toBeTruthy();
  });

  it('also gives an already-entitled visitor a way out', async () => {
    // Abone olduktan sonra paywall'a geri dönen kullanıcı da aynı çıkmazdaydı.
    mockEntitlement.isSubscribed = true;
    await render(<PaywallScreen />);

    expect(screen.queryByText(FREE)).toBeNull();
    fireEvent.press(screen.getByLabelText(DONE));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
