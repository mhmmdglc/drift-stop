/// <reference types="jest" />
jest.mock('@/db/quotesCache', () => ({
  purgePremiumQuotes: jest.fn(),
  countCachedPremiumQuotes: jest.fn(),
  clearPurgedPremiumQuoteIds: jest.fn(),
  getPremiumBackfillCount: jest.fn(),
  setPremiumBackfillCount: jest.fn(),
}));
jest.mock('@/db/packsCache', () => ({
  getExpectedPremiumQuoteCount: jest.fn(),
}));
jest.mock('@/services/quotesSync', () => ({
  syncPremiumQuotes: jest.fn(),
}));
jest.mock('@/utils/crashReporting', () => ({
  reportError: jest.fn(),
}));

import {
  getPremiumCacheVersion,
  purgePremiumCacheForSignOut,
  reconcilePremiumCache,
  subscribePremiumCacheVersion,
} from '../premiumCacheGuard';
import { getExpectedPremiumQuoteCount } from '@/db/packsCache';
import {
  clearPurgedPremiumQuoteIds,
  countCachedPremiumQuotes,
  getPremiumBackfillCount,
  purgePremiumQuotes,
  setPremiumBackfillCount,
} from '@/db/quotesCache';
import { syncPremiumQuotes } from '@/services/quotesSync';
import { reportError } from '@/utils/crashReporting';

/** Paket metadata'sı: 18 premium pakette toplam 3325 söz (canlı seed ile aynı büyüklük). */
const EXPECTED_PREMIUM = 3325;

beforeEach(() => {
  jest.clearAllMocks();
  (syncPremiumQuotes as jest.Mock).mockResolvedValue({ synced: 0, cancelled: false });
  (getExpectedPremiumQuoteCount as jest.Mock).mockReturnValue(EXPECTED_PREMIUM);
  (getPremiumBackfillCount as jest.Mock).mockReturnValue(null);
  (purgePremiumQuotes as jest.Mock).mockReturnValue(0);
  (countCachedPremiumQuotes as jest.Mock).mockReturnValue(0);
});

describe("reconcilePremiumCache — 'unknown' (entitlement never learned)", () => {
  it('NEVER purges when the entitlement state is unknown', async () => {
    // Regresyon koruması: eskiden imza `entitled: boolean` idi ve çağıran
    // `!loading`e bakıyordu. `loading` `getCustomerInfo()` REDDEDİLDİĞİNDE de
    // kapanıyor → ödeme yapan kullanıcı 'entitled' değil `false` olarak gelir ve
    // 3.325 satır + mezar taşları silinirdi. 'unknown' artık ayrı bir durum.
    const result = await reconcilePremiumCache('unknown');

    expect(result).toEqual({ action: 'unknown', purged: 0 });
    expect(purgePremiumQuotes).not.toHaveBeenCalled();
    expect(syncPremiumQuotes).not.toHaveBeenCalled();
    expect(clearPurgedPremiumQuoteIds).not.toHaveBeenCalled();
  });

  it('does not even look at the cache when the state is unknown', async () => {
    await reconcilePremiumCache('unknown');

    expect(countCachedPremiumQuotes).not.toHaveBeenCalled();
  });
});

describe("reconcilePremiumCache — 'none' (entitlement known to be gone)", () => {
  it('purges the locally cached premium quotes', async () => {
    (purgePremiumQuotes as jest.Mock).mockReturnValue(EXPECTED_PREMIUM);

    const result = await reconcilePremiumCache('none');

    expect(purgePremiumQuotes).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ action: 'purged', purged: EXPECTED_PREMIUM });
  });

  it('never downloads anything while purging', async () => {
    (purgePremiumQuotes as jest.Mock).mockReturnValue(10);

    await reconcilePremiumCache('none');

    expect(syncPremiumQuotes).not.toHaveBeenCalled();
  });

  it('is a cheap no-op when there is nothing premium cached (free user, every launch)', async () => {
    const result = await reconcilePremiumCache('none');

    expect(result).toEqual({ action: 'noop', purged: 0 });
    expect(syncPremiumQuotes).not.toHaveBeenCalled();
  });
});

describe("reconcilePremiumCache — 'entitled'", () => {
  it('does not purge and does not re-download when the cache is complete', async () => {
    (countCachedPremiumQuotes as jest.Mock).mockReturnValue(EXPECTED_PREMIUM);

    const result = await reconcilePremiumCache('entitled');

    expect(purgePremiumQuotes).not.toHaveBeenCalled();
    expect(syncPremiumQuotes).not.toHaveBeenCalled();
    expect(result).toEqual({ action: 'noop', purged: 0 });
  });

  it('re-downloads premium content after a purge (re-subscribe recovery)', async () => {
    (countCachedPremiumQuotes as jest.Mock).mockReturnValue(0);
    (syncPremiumQuotes as jest.Mock).mockResolvedValue({
      synced: EXPECTED_PREMIUM,
      cancelled: false,
    });

    const result = await reconcilePremiumCache('entitled');

    expect(syncPremiumQuotes).toHaveBeenCalledTimes(1);
    expect(purgePremiumQuotes).not.toHaveBeenCalled();
    expect(result).toEqual({ action: 'restored', purged: 0 });
  });

  it('clears the purge tombstones once the rows are actually back', async () => {
    (syncPremiumQuotes as jest.Mock).mockResolvedValue({
      synced: EXPECTED_PREMIUM,
      cancelled: false,
    });

    await reconcilePremiumCache('entitled');

    expect(clearPurgedPremiumQuoteIds).toHaveBeenCalledTimes(1);
  });

  it('reports restore-pending (so the caller retries) when the server returned nothing yet', async () => {
    // RevenueCat istemcide hak açıldı ama webhook `profiles.is_premium`'u henüz
    // yazmadı → RLS premium satır vermez.
    const result = await reconcilePremiumCache('entitled');

    expect(result).toEqual({ action: 'restore-pending', purged: 0 });
    expect(clearPurgedPremiumQuoteIds).not.toHaveBeenCalled();
    expect(setPremiumBackfillCount).not.toHaveBeenCalled();
  });

  it('writes nothing and stops retrying when the caller cancelled mid-restore', async () => {
    (syncPremiumQuotes as jest.Mock).mockResolvedValue({ synced: 0, cancelled: true });

    const result = await reconcilePremiumCache('entitled', { isCancelled: () => true });

    expect(result).toEqual({ action: 'cancelled', purged: 0 });
    expect(clearPurgedPremiumQuoteIds).not.toHaveBeenCalled();
    expect(setPremiumBackfillCount).not.toHaveBeenCalled();
  });

  it('passes the cancellation probe down to the sync layer', async () => {
    const isCancelled = () => false;

    await reconcilePremiumCache('entitled', { isCancelled });

    expect(syncPremiumQuotes).toHaveBeenCalledWith({ isCancelled });
  });
});

describe('reconcilePremiumCache — cache sufficiency (an incomplete cache must converge)', () => {
  it('re-downloads when the cache holds fewer rows than the packs metadata expects', async () => {
    // `count > 0` yeterli sanılırsa 1 satırlık cache "tam" kabul edilir ve
    // kullanıcı sonsuza kadar eksik içerikle kalır.
    (countCachedPremiumQuotes as jest.Mock).mockReturnValue(1);
    (syncPremiumQuotes as jest.Mock).mockResolvedValue({
      synced: EXPECTED_PREMIUM,
      cancelled: false,
    });

    const result = await reconcilePremiumCache('entitled');

    expect(syncPremiumQuotes).toHaveBeenCalledTimes(1);
    expect(result.action).toBe('restored');
  });

  it('accepts a cache that exceeds the expected count (metadata lagging behind content)', async () => {
    (countCachedPremiumQuotes as jest.Mock).mockReturnValue(EXPECTED_PREMIUM + 40);

    const result = await reconcilePremiumCache('entitled');

    expect(result.action).toBe('noop');
    expect(syncPremiumQuotes).not.toHaveBeenCalled();
  });

  it('falls back to "not empty" when pack metadata has not synced yet (no count to compare)', async () => {
    (getExpectedPremiumQuoteCount as jest.Mock).mockReturnValue(0);
    (countCachedPremiumQuotes as jest.Mock).mockReturnValue(12);

    const result = await reconcilePremiumCache('entitled');

    expect(result.action).toBe('noop');
    expect(syncPremiumQuotes).not.toHaveBeenCalled();
  });

  it('records how many rows a full backfill actually returned', async () => {
    (countCachedPremiumQuotes as jest.Mock).mockReturnValue(0);
    (syncPremiumQuotes as jest.Mock).mockResolvedValue({ synced: 3300, cancelled: false });

    await reconcilePremiumCache('entitled');

    expect(setPremiumBackfillCount).toHaveBeenCalledWith(3300);
  });

  it('stops re-downloading every launch when the server genuinely has fewer rows than the metadata', async () => {
    // Sapma senaryosu: metadata 3325 diyor, sunucu 3300 veriyor. Filigran olmasa
    // "3300 < 3325" her açılışta tam indirme tetiklerdi.
    (countCachedPremiumQuotes as jest.Mock).mockReturnValue(3300);
    (getPremiumBackfillCount as jest.Mock).mockReturnValue(3300);

    const result = await reconcilePremiumCache('entitled');

    expect(result.action).toBe('noop');
    expect(syncPremiumQuotes).not.toHaveBeenCalled();
  });

  it('still re-downloads when the cache is below even the recorded backfill', async () => {
    (countCachedPremiumQuotes as jest.Mock).mockReturnValue(100);
    (getPremiumBackfillCount as jest.Mock).mockReturnValue(3300);

    await reconcilePremiumCache('entitled');

    expect(syncPremiumQuotes).toHaveBeenCalledTimes(1);
  });
});

describe('reconcilePremiumCache — error handling on a destructive path', () => {
  it('swallows a purge failure instead of rejecting (deleteAccount must still resolve)', async () => {
    (purgePremiumQuotes as jest.Mock).mockImplementation(() => {
      throw new Error('database or disk is full');
    });

    const result = await reconcilePremiumCache('none');

    expect(result).toEqual({ action: 'failed', purged: 0 });
    expect(reportError).toHaveBeenCalled();
  });

  it('swallows a failure in the restore branch too', async () => {
    (countCachedPremiumQuotes as jest.Mock).mockImplementation(() => {
      throw new Error('no such table: quotes');
    });

    const result = await reconcilePremiumCache('entitled');

    expect(result).toEqual({ action: 'failed', purged: 0 });
  });
});

describe('purgePremiumCacheForSignOut', () => {
  it('purges immediately without waiting for RevenueCat', () => {
    (purgePremiumQuotes as jest.Mock).mockReturnValue(EXPECTED_PREMIUM);

    expect(purgePremiumCacheForSignOut()).toBe(EXPECTED_PREMIUM);
    expect(purgePremiumQuotes).toHaveBeenCalledTimes(1);
  });

  it('never throws — deleteAccount() runs it after the account is already gone', () => {
    (purgePremiumQuotes as jest.Mock).mockImplementation(() => {
      throw new Error('database or disk is full');
    });

    expect(purgePremiumCacheForSignOut()).toBe(0);
    expect(reportError).toHaveBeenCalled();
  });
});

describe('premium cache version (screen invalidation signal)', () => {
  it('bumps and notifies subscribers when rows are purged', async () => {
    (purgePremiumQuotes as jest.Mock).mockReturnValue(10);
    const listener = jest.fn();
    const unsubscribe = subscribePremiumCacheVersion(listener);
    const before = getPremiumCacheVersion();

    await reconcilePremiumCache('none');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getPremiumCacheVersion()).toBe(before + 1);
    unsubscribe();
  });

  it('bumps after a restore so screens re-read the cache the purchase just filled', async () => {
    (syncPremiumQuotes as jest.Mock).mockResolvedValue({
      synced: EXPECTED_PREMIUM,
      cancelled: false,
    });
    const listener = jest.fn();
    const unsubscribe = subscribePremiumCacheVersion(listener);
    const before = getPremiumCacheVersion();

    await reconcilePremiumCache('entitled');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getPremiumCacheVersion()).toBe(before + 1);
    unsubscribe();
  });

  it('does not bump when nothing changed on disk', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribePremiumCacheVersion(listener);

    await reconcilePremiumCache('none'); // silinecek satır yok
    (countCachedPremiumQuotes as jest.Mock).mockReturnValue(EXPECTED_PREMIUM);
    await reconcilePremiumCache('entitled'); // içerik zaten tam

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('stops notifying after unsubscribe', async () => {
    (purgePremiumQuotes as jest.Mock).mockReturnValue(5);
    const listener = jest.fn();
    subscribePremiumCacheVersion(listener)();

    await reconcilePremiumCache('none');

    expect(listener).not.toHaveBeenCalled();
  });
});
