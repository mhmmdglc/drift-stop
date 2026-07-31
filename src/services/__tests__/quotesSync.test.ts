/// <reference types="jest" />
jest.mock('@/db/quotesCache', () => ({
  getLastSyncAt: jest.fn(),
  setLastSyncAt: jest.fn(),
  upsertQuotes: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

import { syncPremiumQuotes, syncQuotes } from '../quotesSync';
import { getLastSyncAt, setLastSyncAt, upsertQuotes } from '@/db/quotesCache';
import { supabase } from '@/lib/supabase';

const mockFrom = (supabase as unknown as { from: jest.Mock }).from;

function mockRangeReturning(pages: Array<{ data: unknown[] | null; error: unknown } | Error>) {
  const range = jest.fn();
  for (const page of pages) {
    if (page instanceof Error) range.mockRejectedValueOnce(page);
    else range.mockResolvedValueOnce(page);
  }
  mockFrom.mockImplementation(() => ({
    select: () => ({
      gt: () => ({
        order: () => ({
          order: () => ({ range }),
        }),
      }),
    }),
  }));
  return range;
}

/** `syncPremiumQuotes` zinciri farklı: select().eq().order().range() — `gt` YOK. */
function mockPremiumChain(pages: ({ data: unknown[] | null; error: unknown } | Error)[]) {
  const range = jest.fn();
  for (const page of pages) {
    if (page instanceof Error) range.mockRejectedValueOnce(page);
    else range.mockResolvedValueOnce(page);
  }
  const gt = jest.fn();
  const eq = jest.fn(() => ({ order: () => ({ range }) }));
  mockFrom.mockImplementation(() => ({
    select: () => ({ eq, gt }),
  }));
  return { range, eq, gt };
}

const row = (id: number, updatedAt: string) => ({
  id,
  text: `t${id}`,
  text_tr: `m${id}`,
  author: 'a',
  origin: 'o',
  origin_emoji: '🔥',
  category: 'fire',
  era: 'modern',
  tags: ['motivation'],
  is_premium: false,
  pack_id: null,
  updated_at: updatedAt,
});

beforeEach(() => {
  jest.clearAllMocks();
  (getLastSyncAt as jest.Mock).mockReturnValue('2020-01-01T00:00:00.000Z');
});

describe('syncQuotes', () => {
  it('does no synchronous work before its first await', async () => {
    // Buradaki 1000 satırlık senkron seed, `void syncQuotes()` ile çağrılmasına
    // rağmen açılışta JS thread'ini 396 ms bloke ediyordu: bir async fonksiyonun
    // gövdesi ilk `await`'e kadar çağıran yerde senkron çalışır. Seed kaldırıldı
    // (yazdığı ücretsiz satırları hiçbir sorgu okuyamıyordu — okuyucuların hepsi
    // premium filtreliyor, filtresiz olan tek okuyucuya da statik dizi yüzünden
    // ücretsiz id ile hiç ulaşılmıyor). Bu test o senkron ön-ekin geri gelmesini
    // yakalar: promise dönene kadar cache'e hiçbir yazma olmamalı.
    mockRangeReturning([{ data: [], error: null }]);
    const pending = syncQuotes();
    expect(upsertQuotes).not.toHaveBeenCalled();
    await pending;
  });

  it('upserts fetched rows and advances the sync cursor to the newest updated_at', async () => {
    const range = mockRangeReturning([
      { data: [row(1, '2024-01-01T00:00:00.000Z'), row(2, '2024-02-01T00:00:00.000Z')], error: null },
    ]);

    const result = await syncQuotes();

    expect(range).toHaveBeenCalledTimes(1);
    expect(result.synced).toBe(2);
    expect(upsertQuotes).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1, textTr: 'm1' }),
      expect.objectContaining({ id: 2, textTr: 'm2' }),
    ]);
    expect(setLastSyncAt).toHaveBeenCalledWith('2024-02-01T00:00:00.000Z');
  });

  it('paginates when a page comes back full', async () => {
    const fullPage = Array.from({ length: 500 }, (_, i) => row(i + 1, '2024-01-01T00:00:00.000Z'));
    const range = mockRangeReturning([
      { data: fullPage, error: null },
      { data: [row(501, '2024-03-01T00:00:00.000Z')], error: null },
    ]);

    const result = await syncQuotes();

    expect(range).toHaveBeenCalledTimes(2);
    expect(result.synced).toBe(501);
  });

  it('swallows errors and leaves the sync cursor untouched', async () => {
    mockRangeReturning([new Error('network down')]);

    const result = await syncQuotes();

    expect(result.synced).toBe(0);
    expect(setLastSyncAt).not.toHaveBeenCalled();
  });

  it('is a no-op when Supabase is not configured', async () => {
    jest.resetModules();
    jest.doMock('@/lib/supabase', () => ({ supabase: null }));
    jest.doMock('@/db/quotesCache', () => ({
          getLastSyncAt: jest.fn(),
      setLastSyncAt: jest.fn(),
      upsertQuotes: jest.fn(),
    }));

    let syncWithoutSupabase: typeof syncQuotes;
    let cache: typeof import('@/db/quotesCache');
    jest.isolateModules(() => {
      syncWithoutSupabase = require('../quotesSync').syncQuotes;
      cache = require('@/db/quotesCache');
    });

    const result = await syncWithoutSupabase!();

    expect(result.synced).toBe(0);
    expect(cache!.upsertQuotes).not.toHaveBeenCalled();
  });
});

describe('syncPremiumQuotes (re-subscribe recovery)', () => {
  it('re-fetches every premium row regardless of the delta cursor', async () => {
    // Kritik nokta: temizlikten sonra sunucudaki `updated_at` değişmediği için
    // imleç zaten o satırların ötesinde. Bu yüzden burada `gt(updated_at)` YOK,
    // sadece `eq(is_premium, true)` — aksi halde içerik bir daha asla geri gelmezdi.
    const { range, eq, gt } = mockPremiumChain([
      { data: [row(100001, '2024-01-01T00:00:00.000Z')], error: null },
    ]);

    const result = await syncPremiumQuotes();

    expect(eq).toHaveBeenCalledWith('is_premium', true);
    expect(gt).not.toHaveBeenCalled();
    expect(range).toHaveBeenCalledTimes(1);
    expect(result.synced).toBe(1);
    expect(upsertQuotes).toHaveBeenCalledWith([expect.objectContaining({ id: 100001 })]);
  });

  it('writes nothing when the caller cancelled while the fetch was in flight', async () => {
    // Senaryo: geri yükleme 2-5 sn sürerken kullanıcı çıkış yapar ve cache
    // temizlenir. Gecikmiş satırlar temizliğin ÜSTÜNE yazılmamalı.
    mockPremiumChain([{ data: [row(100001, '2024-01-01T00:00:00.000Z')], error: null }]);

    const result = await syncPremiumQuotes({ isCancelled: () => true });

    expect(result).toEqual({ synced: 0, cancelled: true });
    expect(upsertQuotes).not.toHaveBeenCalled();
  });

  it('writes normally when the cancellation probe stays false', async () => {
    mockPremiumChain([{ data: [row(100001, '2024-01-01T00:00:00.000Z')], error: null }]);

    const result = await syncPremiumQuotes({ isCancelled: () => false });

    expect(result).toEqual({ synced: 1, cancelled: false });
    expect(upsertQuotes).toHaveBeenCalledTimes(1);
  });

  it('never advances the delta cursor (a backfill must not hide free-row updates)', async () => {
    mockPremiumChain([{ data: [row(100001, '2024-01-01T00:00:00.000Z')], error: null }]);

    await syncPremiumQuotes();

    expect(setLastSyncAt).not.toHaveBeenCalled();
  });

  it('paginates through the whole premium set', async () => {
    const fullPage = Array.from({ length: 500 }, (_, i) => row(100001 + i, '2024-01-01T00:00:00.000Z'));
    const { range } = mockPremiumChain([
      { data: fullPage, error: null },
      { data: [row(100501, '2024-01-01T00:00:00.000Z')], error: null },
    ]);

    const result = await syncPremiumQuotes();

    expect(range).toHaveBeenCalledTimes(2);
    expect(result.synced).toBe(501);
  });

  it('swallows errors and writes nothing (caller retries)', async () => {
    mockPremiumChain([new Error('rls denied')]);

    const result = await syncPremiumQuotes();

    expect(result.synced).toBe(0);
    expect(upsertQuotes).not.toHaveBeenCalled();
  });

  it('does not write when Supabase is not configured', async () => {
    jest.resetModules();
    jest.doMock('@/lib/supabase', () => ({ supabase: null }));
    jest.doMock('@/db/quotesCache', () => ({
          getLastSyncAt: jest.fn(),
      setLastSyncAt: jest.fn(),
      upsertQuotes: jest.fn(),
    }));

    let restoreWithoutSupabase: typeof syncPremiumQuotes;
    let cache: typeof import('@/db/quotesCache');
    jest.isolateModules(() => {
      restoreWithoutSupabase = require('../quotesSync').syncPremiumQuotes;
      cache = require('@/db/quotesCache');
    });

    const result = await restoreWithoutSupabase!();

    expect(result.synced).toBe(0);
    expect(cache!.upsertQuotes).not.toHaveBeenCalled();
  });
});
