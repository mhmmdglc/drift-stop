/// <reference types="jest" />
jest.mock('@/data/quotes', () => ({
  getQuoteById: jest.fn(),
}));
jest.mock('@/db/quotesCache', () => ({
  getCachedQuoteById: jest.fn(),
  getCachedQuotesByPackId: jest.fn(),
}));

import { getQuoteByIdAnySource, getPackQuotes } from '../quotesAnySource';
import { getQuoteById } from '@/data/quotes';
import { getCachedQuoteById, getCachedQuotesByPackId } from '@/db/quotesCache';

const staticQuote = { id: 1, text: 'static' } as unknown as ReturnType<typeof getQuoteById>;
const cachedQuote = { id: 100001, text: 'from pack' } as unknown as ReturnType<typeof getCachedQuoteById>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getQuoteByIdAnySource', () => {
  it('returns the static quote without touching the cache when found', () => {
    (getQuoteById as jest.Mock).mockReturnValue(staticQuote);

    const result = getQuoteByIdAnySource(1);

    expect(result).toBe(staticQuote);
    expect(getCachedQuoteById).not.toHaveBeenCalled();
  });

  it('falls back to the cache when the static array has no match', () => {
    (getQuoteById as jest.Mock).mockReturnValue(undefined);
    (getCachedQuoteById as jest.Mock).mockReturnValue(cachedQuote);

    const result = getQuoteByIdAnySource(100001);

    expect(getCachedQuoteById).toHaveBeenCalledWith(100001);
    expect(result).toBe(cachedQuote);
  });

  it('returns undefined when neither source has the id', () => {
    (getQuoteById as jest.Mock).mockReturnValue(undefined);
    (getCachedQuoteById as jest.Mock).mockReturnValue(null);

    expect(getQuoteByIdAnySource(999999)).toBeUndefined();
  });
});

describe('getPackQuotes', () => {
  it('delegates to the cache lookup by pack id', () => {
    (getCachedQuotesByPackId as jest.Mock).mockReturnValue([cachedQuote]);

    expect(getPackQuotes('stoics')).toEqual([cachedQuote]);
    expect(getCachedQuotesByPackId).toHaveBeenCalledWith('stoics');
  });
});
