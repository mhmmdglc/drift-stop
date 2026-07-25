/// <reference types="jest" />

/**
 * `expo-sqlite` Jest'te yok — çalıştırılan SQL'in kendisi doğrulanıyor.
 * Buradaki asıl konu: premium cache'in "tam mı" sorusu, herkese açık paket
 * metadata'sından (`quote_count`) ölçülüyor (bkz. `services/premiumCacheGuard.ts`).
 */
const mockExecSync = jest.fn();
const mockGetFirstSync = jest.fn();
const mockGetAllSync = jest.fn();

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: mockExecSync,
    runSync: jest.fn(),
    getFirstSync: mockGetFirstSync,
    getAllSync: mockGetAllSync,
    withTransactionSync: (fn: () => void) => fn(),
    prepareSync: () => ({ executeSync: jest.fn(), finalizeSync: jest.fn() }),
  }),
}));

import { getExpectedPremiumQuoteCount } from '../packsCache';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getExpectedPremiumQuoteCount', () => {
  it('sums quote_count over premium packs only', () => {
    mockGetFirstSync.mockReturnValue({ total: 3325 });

    expect(getExpectedPremiumQuoteCount()).toBe(3325);
    expect(mockGetFirstSync).toHaveBeenCalledWith(
      'select coalesce(sum(quote_count), 0) as total from packs where is_premium = 1'
    );
  });

  it('returns 0 when pack metadata has never synced (caller must not treat it as "expect 0")', () => {
    mockGetFirstSync.mockReturnValue({ total: 0 });
    expect(getExpectedPremiumQuoteCount()).toBe(0);
  });

  it('survives a missing row', () => {
    mockGetFirstSync.mockReturnValue(null);
    expect(getExpectedPremiumQuoteCount()).toBe(0);
  });
});
