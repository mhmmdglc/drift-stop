/// <reference types="jest" />

/**
 * Favoriler ekranının premium akışı — iki sessiz regresyonu koruyor:
 *
 * 1. **Geri yükleme sonrası tazeleme.** Satın alma bittiğinde `isPro` anında
 *    true olur ama premium satırlar SQLite'a 2-5 sn sonra düşer. Ekran sadece
 *    `[ids, isPro]`'ya bağlıysa satırlar geldiğinde HİÇBİR ŞEY yeniden hesaplanmaz
 *    ve ödeme yapan kullanıcı kilidi görmeye devam eder. Favoriler mount kalan bir
 *    sekme olduğu için sekme değiştirmek de kurtarmıyor.
 * 2. **Entitlement çözülene kadar kilit gösterilmemesi.** `loading` sırasında
 *    `isPro` false görünür; Pro kullanıcı sekmeye erken girerse kilitli satırlar
 *    görüp sonra metnin yerine oturmasını izler.
 */

const mockPurchases = { configured: true, loading: false, entitlementKnown: true, isPro: false };
const mockFavorites: { ids: number[]; remove: jest.Mock } = { ids: [], remove: jest.fn() };

// Sürüm sayacının test içi ikizi: gerçek servis `expo-sqlite` + Supabase'e
// dokunduğu için burada sadece sinyal mekanizması taklit ediliyor (bumpu asıl
// yapan kod `services/__tests__/premiumCacheGuard.test.ts`te doğrulanıyor).
const mockVersionStore = { value: 0, listeners: new Set<() => void>() };
function bumpVersion() {
  mockVersionStore.value += 1;
  for (const l of mockVersionStore.listeners) l();
}

jest.mock('@/services/premiumCacheGuard', () => ({
  getPremiumCacheVersion: () => mockVersionStore.value,
  subscribePremiumCacheVersion: (listener: () => void) => {
    mockVersionStore.listeners.add(listener);
    return () => mockVersionStore.listeners.delete(listener);
  },
}));

jest.mock('@/hooks/usePurchases', () => ({ usePurchases: () => mockPurchases }));
jest.mock('@/hooks/useFavorites', () => ({ useFavorites: () => mockFavorites }));
jest.mock('@/i18n/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'en' }),
}));
jest.mock('@/hooks/use-theme', () => {
  const { DarkColors } = require('@/constants/colors');
  return { useTheme: () => ({ colors: DarkColors, themeName: 'dark', mode: 'dark' }) };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/data/quotesAnySource', () => ({ lookupQuoteAnySource: jest.fn() }));

import { act, render, screen } from '@testing-library/react-native';

import FavoritesScreen from '@/app/(tabs)/favorites';
import { lookupQuoteAnySource } from '@/data/quotesAnySource';
import type { Quote } from '@/types/quote';

const PREMIUM_ID = 100001;
const premiumQuote = {
  id: PREMIUM_ID,
  text: 'premium body',
  textTr: 'premium metin',
  author: 'Seneca',
  isPremium: true,
} as unknown as Quote;

const mockLookup = lookupQuoteAnySource as jest.Mock;

/** Cache boş: premium favori 'locked' döner (mezar taşı üzerinden). */
function cacheEmpty() {
  mockLookup.mockImplementation(() => ({ status: 'locked' }));
}
/** Cache dolu ve hak var: aynı id artık çözülüyor. */
function cacheFilled() {
  mockLookup.mockImplementation((_id: number, { entitled }: { entitled: boolean }) =>
    entitled ? { status: 'found', quote: premiumQuote } : { status: 'locked' }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVersionStore.value = 0;
  mockVersionStore.listeners.clear();
  mockPurchases.configured = true;
  mockPurchases.loading = false;
  mockPurchases.entitlementKnown = true;
  mockPurchases.isPro = false;
  mockFavorites.ids = [PREMIUM_ID];
  cacheEmpty();
});

describe('Favorites — premium cache invalidation after a restore', () => {
  it('shows the locked row for a lapsed subscriber', async () => {
    await render(<FavoritesScreen />);

    expect(screen.getByText(/favorites.lockedPremium/)).toBeTruthy();
  });

  it('re-reads the cache when the restore lands seconds after the purchase', async () => {
    // 1. Kilitli başla (hak yok, cache boş).
    const { rerender } = await render(<FavoritesScreen />);
    expect(screen.getByText(/favorites.lockedPremium/)).toBeTruthy();

    // 2. Satın alma: isPro true olur ama içerik daha inmedi → hâlâ kilitli.
    mockPurchases.isPro = true;
    await act(async () => {
      rerender(<FavoritesScreen />);
    });
    expect(screen.getByText(/favorites.lockedPremium/)).toBeTruthy();

    // 3. `syncPremiumQuotes` 2-5 sn sonra satırları yazar ve sürümü artırır.
    //    KRİTİK: bu adımda başka hiçbir prop/state değişmiyor — ekranın tek
    //    tazeleme sinyali sürüm sayacı. Buraya kadar yeşil, buradan sonra
    //    kırmızıya dönen bir test = memo bağımlılığı düşmüş demektir.
    cacheFilled();
    await act(async () => {
      bumpVersion();
    });

    expect(screen.getByText('premium body')).toBeTruthy();
    expect(screen.queryByText(/favorites.lockedPremium/)).toBeNull();
  });

  it('re-reads the cache after a purge, too (entitlement lapsed while mounted)', async () => {
    mockPurchases.isPro = true;
    cacheFilled();
    await render(<FavoritesScreen />);
    expect(screen.getByText('premium body')).toBeTruthy();

    // Hak düştü + temizlik çalıştı: ekranın kilide dönmesi için de aynı sinyal gerekiyor.
    mockPurchases.isPro = false;
    cacheEmpty();
    await act(async () => {
      bumpVersion();
    });

    expect(screen.getByText(/favorites.lockedPremium/)).toBeTruthy();
  });
});

describe('Favorites — loading treatment while entitlement resolves', () => {
  it('shows a loading row instead of a lock while customerInfo is still in flight', async () => {
    // Pro kullanıcı sekmeye `getCustomerInfo()` dönmeden giriyor: `isPro` henüz
    // false olduğu için satır 'locked' çözülür — kilit göstermek yanıltıcı olur.
    mockPurchases.loading = true;
    mockPurchases.entitlementKnown = false;

    await render(<FavoritesScreen />);

    expect(screen.getByText('common.loading')).toBeTruthy();
    expect(screen.queryByText(/favorites.lockedPremium/)).toBeNull();
  });

  it('falls back to the lock once loading finishes and the user really has no entitlement', async () => {
    mockPurchases.loading = true;
    mockPurchases.entitlementKnown = false;
    const { rerender } = await render(<FavoritesScreen />);
    expect(screen.getByText('common.loading')).toBeTruthy();

    mockPurchases.loading = false;
    mockPurchases.entitlementKnown = true;
    await act(async () => {
      rerender(<FavoritesScreen />);
    });

    expect(screen.getByText(/favorites.lockedPremium/)).toBeTruthy();
    expect(screen.queryByText('common.loading')).toBeNull();
  });

  it('never delays a free favorite behind entitlement loading', async () => {
    mockPurchases.loading = true;
    mockPurchases.entitlementKnown = false;
    mockFavorites.ids = [1];
    const freeQuote = { id: 1, text: 'free body', textTr: 'ücretsiz', author: 'Marcus' };
    mockLookup.mockImplementation(() => ({ status: 'found', quote: freeQuote }));

    await render(<FavoritesScreen />);

    expect(screen.getByText('free body')).toBeTruthy();
    expect(screen.queryByText('common.loading')).toBeNull();
  });
});
