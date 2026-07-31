/// <reference types="jest" />
jest.mock('@/services/premiumCacheGuard', () => ({
  reconcilePremiumCache: jest.fn(),
}));

const mockPurchases = {
  configured: true,
  loading: false,
  entitlementKnown: true,
  isPro: false,
  isAdsRemoved: false,
};
// Deneme durumu. `useEntitlement` BİLİNÇLİ olarak mocklanmıyor: hatanın yaşayacağı
// yer tam olarak "abonelik + deneme"nin birleştirilmesi, o yüzden gerçek hook
// çalışsın ve bu iki yaprak mocklansın.
const mockTrial = {
  loaded: true,
  active: false,
  daysLeft: 0,
  dayIndex: -1,
  startedAt: null as number | null,
  endedNeedsNotice: false,
  acknowledgeEnded: () => {},
};
const mockAuth: { user: { id: string } | null } = { user: { id: 'user-1' } };

jest.mock('@/hooks/usePurchases', () => ({
  usePurchases: () => mockPurchases,
}));
jest.mock('@/hooks/useTrial', () => ({
  useTrial: () => mockTrial,
}));
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuth,
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { usePremiumCacheGuard } from '../usePremiumCacheGuard';
import { reconcilePremiumCache } from '@/services/premiumCacheGuard';

const mockReconcile = reconcilePremiumCache as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockReconcile.mockResolvedValue({ action: 'noop', purged: 0 });
  mockPurchases.configured = true;
  mockPurchases.loading = false;
  mockPurchases.entitlementKnown = true;
  mockPurchases.isPro = false;
  mockPurchases.isAdsRemoved = false;
  mockTrial.loaded = true;
  mockTrial.active = false;
  mockTrial.daysLeft = 0;
  mockAuth.user = { id: 'user-1' };
});

describe('usePremiumCacheGuard', () => {
  it('purges when the entitlement is known to be gone', async () => {
    await renderHook(() => usePremiumCacheGuard());

    await waitFor(() => expect(mockReconcile).toHaveBeenCalledWith('none', expect.anything()));
  });

  it('does NOTHING while the entitlement state is still loading', async () => {
    mockPurchases.loading = true;
    mockPurchases.entitlementKnown = false;

    await renderHook(() => usePremiumCacheGuard());

    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('does NOTHING when loading finished but customerInfo never arrived', async () => {
    // EN KRİTİK KORUMA. `usePurchases` `loading`i bir `.finally()` içinde kapatıyor,
    // yani `getCustomerInfo()` REDDEDİLDİĞİNDE de false olur: `loading === false`
    // ama `customerInfo === null`, `isPro === false`. Bu duruma "hak yok" demek,
    // ödeme YAPAN kullanıcının 3.325 satırlık cache'ini (çevrimdışı ilk açılış /
    // silinmiş uygulama verisi / bozuk RC cache'i) uçurur. `entitlementKnown`
    // tam olarak bu ayrımı taşıyor — bu test `!loading`e geri dönüşü yakalar.
    mockPurchases.loading = false;
    mockPurchases.entitlementKnown = false;

    await renderHook(() => usePremiumCacheGuard());

    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('does not purge a paying user whose cold-start fetch failed (isPro false, nothing known)', async () => {
    mockPurchases.loading = false;
    mockPurchases.entitlementKnown = false;
    mockPurchases.isPro = false;

    await renderHook(() => usePremiumCacheGuard());

    // 'none' ile çağrılmamalı — hiçbir şeyle çağrılmamalı.
    expect(mockReconcile).not.toHaveBeenCalledWith('none', expect.anything());
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('does nothing when purchases are not configured on this platform', async () => {
    mockPurchases.configured = false;

    await renderHook(() => usePremiumCacheGuard());

    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('NEVER purges a user on the card-less trial', async () => {
    // FAZ B'NİN EN KRİTİK TESTİ. RevenueCat tarafında "deneme" diye bir hak yok,
    // yani denemedeki kullanıcıda `isPro === false`. Bu hook `isPro`ya bakarsa
    // deneme kullanıcısının indirdiği 3.325 satırı HER AÇILIŞTA siler: kullanıcı
    // Pro yaşadığını sanır, paketler boş çıkar. Spec §5.1 bunu "en kolay gözden
    // kaçacak bağlantı noktası" diye işaretledi.
    mockTrial.active = true;
    mockTrial.daysLeft = 5;
    mockPurchases.isPro = false;

    await renderHook(() => usePremiumCacheGuard());

    await waitFor(() => expect(mockReconcile).toHaveBeenCalledWith('entitled', expect.anything()));
    expect(mockReconcile).not.toHaveBeenCalledWith('none', expect.anything());
  });

  it('does NOTHING while the trial stamp is still being read from disk', async () => {
    // `loaded` false iken deneme durumu bilinmiyor. O anda "hak yok" demek,
    // denemedeki kullanıcının cache'ini açılışın ilk anında silmek olurdu.
    mockTrial.loaded = false;

    await renderHook(() => usePremiumCacheGuard());

    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('purges once the trial has ended and there is no subscription', async () => {
    mockTrial.loaded = true;
    mockTrial.active = false;
    mockPurchases.isPro = false;

    await renderHook(() => usePremiumCacheGuard());

    await waitFor(() => expect(mockReconcile).toHaveBeenCalledWith('none', expect.anything()));
  });

  it('keeps the trial entitlement even when RevenueCat is not configured (iOS)', async () => {
    // iOS'ta `appl_` anahtarı yok → `configured` false. Deneme yerel olduğu için
    // yine geçerli; burada 'none' geçmek deneme kullanıcısının içeriğini silerdi.
    mockPurchases.configured = false;
    mockPurchases.entitlementKnown = false;
    mockTrial.active = true;

    await renderHook(() => usePremiumCacheGuard());

    await waitFor(() => expect(mockReconcile).toHaveBeenCalledWith('entitled', expect.anything()));
    expect(mockReconcile).not.toHaveBeenCalledWith('none', expect.anything());
  });

  it('skips the restore attempt for a guest on the trial (RLS would refuse)', async () => {
    mockTrial.active = true;
    mockAuth.user = null;

    await renderHook(() => usePremiumCacheGuard());

    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('restores content for an entitled, signed-in user', async () => {
    mockPurchases.isPro = true;

    await renderHook(() => usePremiumCacheGuard());

    await waitFor(() => expect(mockReconcile).toHaveBeenCalledWith('entitled', expect.anything()));
  });

  it('skips the restore attempt for an entitled user with no session (RLS would refuse)', async () => {
    mockPurchases.isPro = true;
    mockAuth.user = null;

    await renderHook(() => usePremiumCacheGuard());

    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('acts once the entitlement becomes known, not before', async () => {
    mockPurchases.loading = true;
    mockPurchases.entitlementKnown = false;
    const { rerender } = await renderHook(() => usePremiumCacheGuard());
    expect(mockReconcile).not.toHaveBeenCalled();

    mockPurchases.loading = false;
    mockPurchases.entitlementKnown = true;
    await act(async () => {
      rerender(undefined);
    });

    await waitFor(() => expect(mockReconcile).toHaveBeenCalledWith('none', expect.anything()));
  });

  it('passes a cancellation probe that flips when the effect is torn down', async () => {
    mockPurchases.isPro = true;
    const { unmount } = await renderHook(() => usePremiumCacheGuard());
    await waitFor(() => expect(mockReconcile).toHaveBeenCalled());

    const options = mockReconcile.mock.calls[0][1] as { isCancelled: () => boolean };
    expect(options.isCancelled()).toBe(false);

    await act(async () => {
      await unmount();
    });

    // Uçuşta olan geri yükleme bundan sonra hiçbir satır yazmamalı.
    expect(options.isCancelled()).toBe(true);
  });

  it('retries the restore when the server has not granted access yet', async () => {
    jest.useFakeTimers();
    mockPurchases.isPro = true;
    mockReconcile.mockResolvedValue({ action: 'restore-pending', purged: 0 });

    await renderHook(() => usePremiumCacheGuard());
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockReconcile).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(mockReconcile).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  it('does not retry a cancelled restore', async () => {
    jest.useFakeTimers();
    mockPurchases.isPro = true;
    mockReconcile.mockResolvedValue({ action: 'cancelled', purged: 0 });

    await renderHook(() => usePremiumCacheGuard());
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
    });
    expect(mockReconcile).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });
});
