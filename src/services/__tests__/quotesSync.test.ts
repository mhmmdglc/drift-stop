/// <reference types="jest" />
jest.mock('@/db/quotesCache', () => ({
  seedIfEmpty: jest.fn(),
  getLastSyncAt: jest.fn(),
  setLastSyncAt: jest.fn(),
  upsertQuotes: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

import { syncQuotes } from '../quotesSync';
import { seedIfEmpty, getLastSyncAt, setLastSyncAt, upsertQuotes } from '@/db/quotesCache';
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
  it('always seeds the local cache first', async () => {
    mockRangeReturning([{ data: [], error: null }]);
    await syncQuotes();
    expect(seedIfEmpty).toHaveBeenCalledTimes(1);
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

  it('is a no-op beyond seeding when Supabase is not configured', async () => {
    jest.resetModules();
    jest.doMock('@/lib/supabase', () => ({ supabase: null }));
    jest.doMock('@/db/quotesCache', () => ({
      seedIfEmpty: jest.fn(),
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
    expect(cache!.seedIfEmpty).toHaveBeenCalledTimes(1);
    expect(cache!.upsertQuotes).not.toHaveBeenCalled();
  });
});
