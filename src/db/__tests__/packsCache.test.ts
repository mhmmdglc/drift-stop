/// <reference types="jest" />

/**
 * `expo-sqlite` Jest'te yok — çalıştırılan SQL'in kendisi doğrulanıyor.
 * Buradaki asıl konu: premium cache'in "tam mı" sorusu, herkese açık paket
 * metadata'sından (`quote_count`) ölçülüyor (bkz. `services/premiumCacheGuard.ts`).
 */
const mockExecSync = jest.fn();
const mockGetFirstSync = jest.fn();
const mockGetAllSync = jest.fn();
const mockRunSync = jest.fn(() => ({ changes: 0 }));

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: mockExecSync,
    runSync: mockRunSync,
    getFirstSync: mockGetFirstSync,
    getAllSync: mockGetAllSync,
    withTransactionSync: (fn: () => void) => fn(),
    prepareSync: () => ({ executeSync: jest.fn(), finalizeSync: jest.fn() }),
  }),
}));

import { deletePacksNotIn, getExpectedPremiumQuoteCount } from '../packsCache';

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

describe('deletePacksNotIn', () => {
  it('yalnızca listede OLMAYAN paketleri siler ve id’leri parametre olarak geçer', () => {
    mockRunSync.mockReturnValue({ changes: 2 });

    const removed = deletePacksNotIn(['stoics', 'eastern']);

    expect(removed).toBe(2);
    const [sql, params] = mockRunSync.mock.calls[0] as unknown as [string, string[]];
    expect(sql).toMatch(/delete from packs where id not in \(\?,\?\)/i);
    // Id'ler SQL'e gömülmüyor, parametre olarak gidiyor — paket id'leri sunucudan
    // gelen veri ve string birleştirme burada enjeksiyon yüzeyi olurdu.
    expect(params).toEqual(['stoics', 'eastern']);
  });

  it('boş listeyle HİÇBİR ŞEY silmez', () => {
    // Aksi halde `not in ()` tüm tabloyu siler — "cevap gelmedi" durumunun
    // katalogu yok etmesi bu projede daha önce yaşanan sınıf bir hata.
    const removed = deletePacksNotIn([]);

    expect(removed).toBe(0);
    expect(mockRunSync).not.toHaveBeenCalled();
  });
});
