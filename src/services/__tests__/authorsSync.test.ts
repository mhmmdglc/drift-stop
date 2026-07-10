/// <reference types="jest" />
jest.mock('@/db/packsCache', () => ({
  upsertPremiumAuthorCounts: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

import { syncAuthorCounts } from '../authorsSync';
import { upsertPremiumAuthorCounts } from '@/db/packsCache';
import { supabase } from '@/lib/supabase';

const mockRpc = (supabase as unknown as { rpc: jest.Mock }).rpc;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('syncAuthorCounts', () => {
  it('upserts author counts mapped to camelCase fields', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { author: 'Marcus Aurelius', quote_count: 8 },
        { author: 'Seneca', quote_count: 8 },
      ],
      error: null,
    });

    const result = await syncAuthorCounts();

    expect(result.synced).toBe(2);
    expect(upsertPremiumAuthorCounts).toHaveBeenCalledWith([
      { author: 'Marcus Aurelius', quoteCount: 8 },
      { author: 'Seneca', quoteCount: 8 },
    ]);
  });

  it('is a no-op when there are no rows', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const result = await syncAuthorCounts();

    expect(result.synced).toBe(0);
    expect(upsertPremiumAuthorCounts).not.toHaveBeenCalled();
  });

  it('swallows errors', async () => {
    mockRpc.mockRejectedValue(new Error('network down'));

    const result = await syncAuthorCounts();

    expect(result.synced).toBe(0);
    expect(upsertPremiumAuthorCounts).not.toHaveBeenCalled();
  });

  it('is a no-op when Supabase is not configured', async () => {
    jest.resetModules();
    jest.doMock('@/lib/supabase', () => ({ supabase: null }));
    jest.doMock('@/db/packsCache', () => ({ upsertPremiumAuthorCounts: jest.fn() }));

    let syncWithoutSupabase: typeof syncAuthorCounts;
    let cache: { upsertPremiumAuthorCounts: jest.Mock };
    jest.isolateModules(() => {
      syncWithoutSupabase = require('../authorsSync').syncAuthorCounts;
      cache = require('@/db/packsCache');
    });

    const result = await syncWithoutSupabase!();

    expect(result.synced).toBe(0);
    expect(cache!.upsertPremiumAuthorCounts).not.toHaveBeenCalled();
  });
});
