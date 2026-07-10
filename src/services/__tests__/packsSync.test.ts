/// <reference types="jest" />
jest.mock('@/db/packsCache', () => ({
  upsertPacks: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

import { syncPacks } from '../packsSync';
import { upsertPacks } from '@/db/packsCache';
import { supabase } from '@/lib/supabase';

const mockFrom = (supabase as unknown as { from: jest.Mock }).from;

function mockSelectReturning(result: { data: unknown[] | null; error: unknown } | Error) {
  const order = jest.fn();
  if (result instanceof Error) order.mockRejectedValue(result);
  else order.mockResolvedValue(result);
  mockFrom.mockImplementation(() => ({ select: () => ({ order }) }));
  return order;
}

const packRow = (id: string) => ({
  id,
  name: { tr: id, en: id },
  description: null,
  cover_image_url: null,
  is_premium: true,
  sort_order: 0,
  quote_count: 24,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('syncPacks', () => {
  it('upserts packs mapped to camelCase fields', async () => {
    mockSelectReturning({ data: [packRow('stoics')], error: null });

    const result = await syncPacks();

    expect(result.synced).toBe(1);
    expect(upsertPacks).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'stoics',
        coverImageUrl: null,
        isPremium: true,
        sortOrder: 0,
        quoteCount: 24,
      }),
    ]);
  });

  it('is a no-op when there are no rows', async () => {
    mockSelectReturning({ data: [], error: null });

    const result = await syncPacks();

    expect(result.synced).toBe(0);
    expect(upsertPacks).not.toHaveBeenCalled();
  });

  it('swallows errors', async () => {
    mockSelectReturning(new Error('network down'));

    const result = await syncPacks();

    expect(result.synced).toBe(0);
    expect(upsertPacks).not.toHaveBeenCalled();
  });

  it('is a no-op when Supabase is not configured', async () => {
    jest.resetModules();
    jest.doMock('@/lib/supabase', () => ({ supabase: null }));
    jest.doMock('@/db/packsCache', () => ({ upsertPacks: jest.fn() }));

    let syncWithoutSupabase: typeof syncPacks;
    let cache: { upsertPacks: jest.Mock };
    jest.isolateModules(() => {
      syncWithoutSupabase = require('../packsSync').syncPacks;
      cache = require('@/db/packsCache');
    });

    const result = await syncWithoutSupabase!();

    expect(result.synced).toBe(0);
    expect(cache!.upsertPacks).not.toHaveBeenCalled();
  });
});
