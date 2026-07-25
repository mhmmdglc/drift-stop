/// <reference types="jest" />

/**
 * `expo-sqlite` native modülü Jest'te yok — sahte bir bağlantı ile çalışılan SQL'in
 * kendisi doğrulanıyor. Burada asıl korunan şey: temizlik SADECE premium satırlara
 * dokunuyor (ücretsiz 1000 söz asla silinmiyor) ve silmeden ÖNCE mezar taşları yazılıyor.
 */
const mockExecSync = jest.fn();
const mockRunSync = jest.fn();
const mockGetFirstSync = jest.fn();
const mockGetAllSync = jest.fn();
const mockWithTransactionSync = jest.fn((fn: () => void) => fn());

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: mockExecSync,
    runSync: mockRunSync,
    getFirstSync: mockGetFirstSync,
    getAllSync: mockGetAllSync,
    withTransactionSync: mockWithTransactionSync,
    prepareSync: () => ({ executeSync: jest.fn(), finalizeSync: jest.fn() }),
  }),
}));

import {
  clearPurgedPremiumQuoteIds,
  countCachedPremiumQuotes,
  getPremiumBackfillCount,
  isPurgedPremiumQuoteId,
  purgePremiumQuotes,
  setPremiumBackfillCount,
} from '../quotesCache';
import * as quotesCache from '../quotesCache';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('countCachedPremiumQuotes', () => {
  it('counts only premium rows', () => {
    mockGetFirstSync.mockReturnValue({ count: 3325 });

    expect(countCachedPremiumQuotes()).toBe(3325);
    expect(mockGetFirstSync).toHaveBeenCalledWith(
      'select count(*) as count from quotes where is_premium = 1'
    );
  });

  it('treats a missing row as zero', () => {
    mockGetFirstSync.mockReturnValue(null);
    expect(countCachedPremiumQuotes()).toBe(0);
  });
});

describe('purgePremiumQuotes', () => {
  it('deletes premium rows and leaves free rows alone', () => {
    mockGetFirstSync.mockReturnValue({ count: 3325 });

    const purged = purgePremiumQuotes();

    expect(purged).toBe(3325);
    const statements = mockRunSync.mock.calls.map((c) => String(c[0]));
    const deletes = statements.filter((s) => s.startsWith('delete from quotes'));
    expect(deletes).toEqual(['delete from quotes where is_premium = 1']);
    // Hiçbir ifade ücretsiz satırları (is_premium = 0) hedeflemiyor.
    expect(statements.some((s) => s.includes('is_premium = 0'))).toBe(false);
  });

  it('records the purged ids as tombstones before deleting them', () => {
    mockGetFirstSync.mockReturnValue({ count: 2 });

    purgePremiumQuotes();

    const statements = mockRunSync.mock.calls.map((c) => String(c[0]));
    expect(statements[0]).toBe(
      'insert or ignore into purged_premium_quotes (id) select id from quotes where is_premium = 1'
    );
    expect(statements[1]).toBe('delete from quotes where is_premium = 1');
    expect(mockWithTransactionSync).toHaveBeenCalledTimes(1);
  });

  it('does no writes at all when there is nothing premium cached', () => {
    mockGetFirstSync.mockReturnValue({ count: 0 });

    expect(purgePremiumQuotes()).toBe(0);
    expect(mockRunSync).not.toHaveBeenCalled();
    expect(mockWithTransactionSync).not.toHaveBeenCalled();
  });
});

describe('purge tombstones', () => {
  it('recognises a purged premium id', () => {
    mockGetFirstSync.mockReturnValue({ id: 100001 });

    expect(isPurgedPremiumQuoteId(100001)).toBe(true);
    expect(mockGetFirstSync).toHaveBeenCalledWith(
      'select id from purged_premium_quotes where id = ?',
      [100001]
    );
  });

  it('returns false for an unknown id', () => {
    mockGetFirstSync.mockReturnValue(null);
    expect(isPurgedPremiumQuoteId(1)).toBe(false);
  });

  it('clears every tombstone on restore', () => {
    clearPurgedPremiumQuoteIds();
    expect(mockRunSync).toHaveBeenCalledWith('delete from purged_premium_quotes');
  });
});

describe('premium backfill watermark', () => {
  it('returns null when no full backfill has ever completed', () => {
    mockGetFirstSync.mockReturnValue(null);
    expect(getPremiumBackfillCount()).toBeNull();
  });

  it('reads the recorded row count back as a number', () => {
    mockGetFirstSync.mockReturnValue({ value: '3300' });
    expect(getPremiumBackfillCount()).toBe(3300);
  });

  it('treats a corrupt value as "never backfilled" rather than NaN', () => {
    mockGetFirstSync.mockReturnValue({ value: 'not-a-number' });
    expect(getPremiumBackfillCount()).toBeNull();
  });

  it('stores the count in `meta` without touching the delta cursor', () => {
    setPremiumBackfillCount(3300);

    const [sql, key, value] = mockRunSync.mock.calls[0];
    expect(String(sql)).toContain('insert into meta');
    expect(key).toBe('premium_backfill_count');
    expect(value).toBe('3300');
  });
});

describe('premium-capable readers', () => {
  it('exposes no ungated "read everything" helper', () => {
    // `getAllCachedQuotes()` premium satırları da döndürüyordu ve hiçbir yerden
    // çağrılmıyordu — bir sonraki çağıranın sızıntıyı sessizce açmaması için silindi.
    // Cache'ten premium okumak isteyen her yol `quotesAnySource`'un ZORUNLU
    // `{ entitled }` parametresinden geçmeli.
    expect('getAllCachedQuotes' in quotesCache).toBe(false);
  });
});
