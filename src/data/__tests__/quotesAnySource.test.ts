/// <reference types="jest" />
jest.mock('@/data/quotes', () => ({
  getQuoteById: jest.fn(),
}));
jest.mock('@/db/quotesCache', () => ({
  getCachedQuoteById: jest.fn(),
  getCachedQuotesByPackId: jest.fn(),
  getCachedQuotesByAuthor: jest.fn(),
  isPurgedPremiumQuoteId: jest.fn(),
}));

import { getAuthorQuotes, getPackQuotes, lookupQuoteAnySource } from '../quotesAnySource';
import { getQuoteById } from '@/data/quotes';
import {
  getCachedQuoteById,
  getCachedQuotesByAuthor,
  getCachedQuotesByPackId,
  isPurgedPremiumQuoteId,
} from '@/db/quotesCache';
import type { Quote } from '@/types/quote';

const freeStatic = { id: 1, text: 'static', isPremium: false } as unknown as Quote;
const freeCached = { id: 500, text: 'cached free', isPremium: false } as unknown as Quote;
const premiumCached = { id: 100001, text: 'from pack', isPremium: true } as unknown as Quote;

beforeEach(() => {
  jest.clearAllMocks();
  (isPurgedPremiumQuoteId as jest.Mock).mockReturnValue(false);
});

describe('lookupQuoteAnySource', () => {
  it('returns the static quote without touching the cache when found', () => {
    (getQuoteById as jest.Mock).mockReturnValue(freeStatic);

    expect(lookupQuoteAnySource(1, { entitled: true })).toEqual({
      status: 'found',
      quote: freeStatic,
    });
    expect(getCachedQuoteById).not.toHaveBeenCalled();
  });

  it('still returns free quotes when the user has no entitlement', () => {
    (getQuoteById as jest.Mock).mockReturnValue(freeStatic);

    expect(lookupQuoteAnySource(1, { entitled: false })).toEqual({
      status: 'found',
      quote: freeStatic,
    });
  });

  it('returns a free cached quote (not in the static array) without entitlement', () => {
    (getQuoteById as jest.Mock).mockReturnValue(undefined);
    (getCachedQuoteById as jest.Mock).mockReturnValue(freeCached);

    expect(lookupQuoteAnySource(500, { entitled: false })).toEqual({
      status: 'found',
      quote: freeCached,
    });
  });

  it('falls back to the cache for premium quotes when entitled', () => {
    (getQuoteById as jest.Mock).mockReturnValue(undefined);
    (getCachedQuoteById as jest.Mock).mockReturnValue(premiumCached);

    expect(lookupQuoteAnySource(100001, { entitled: true })).toEqual({
      status: 'found',
      quote: premiumCached,
    });
    expect(getCachedQuoteById).toHaveBeenCalledWith(100001);
  });

  it('locks a cached premium quote when the user is not entitled (defence in depth)', () => {
    (getQuoteById as jest.Mock).mockReturnValue(undefined);
    (getCachedQuoteById as jest.Mock).mockReturnValue(premiumCached);

    expect(lookupQuoteAnySource(100001, { entitled: false })).toEqual({ status: 'locked' });
  });

  it('locks a purged premium id so favorites can show a deliberate locked row', () => {
    (getQuoteById as jest.Mock).mockReturnValue(undefined);
    (getCachedQuoteById as jest.Mock).mockReturnValue(null);
    (isPurgedPremiumQuoteId as jest.Mock).mockReturnValue(true);

    expect(lookupQuoteAnySource(100001, { entitled: false })).toEqual({ status: 'locked' });
  });

  it('reports missing when neither source nor the purge tombstones know the id', () => {
    (getQuoteById as jest.Mock).mockReturnValue(undefined);
    (getCachedQuoteById as jest.Mock).mockReturnValue(null);

    expect(lookupQuoteAnySource(999999, { entitled: true })).toEqual({ status: 'missing' });
  });
});

describe('getPackQuotes', () => {
  it('delegates to the cache lookup by pack id when entitled', () => {
    (getCachedQuotesByPackId as jest.Mock).mockReturnValue([premiumCached, freeCached]);

    expect(getPackQuotes('stoics', { entitled: true })).toEqual([premiumCached, freeCached]);
    expect(getCachedQuotesByPackId).toHaveBeenCalledWith('stoics');
  });

  it('drops premium rows but keeps free ones when not entitled', () => {
    (getCachedQuotesByPackId as jest.Mock).mockReturnValue([premiumCached, freeCached]);

    expect(getPackQuotes('stoics', { entitled: false })).toEqual([freeCached]);
  });
});

describe('getAuthorQuotes', () => {
  it('returns the author rows when entitled', () => {
    (getCachedQuotesByAuthor as jest.Mock).mockReturnValue([premiumCached]);

    expect(getAuthorQuotes('Seneca', { entitled: true })).toEqual([premiumCached]);
  });

  it('never reads the cache when not entitled (author lists are premium by definition)', () => {
    expect(getAuthorQuotes('Seneca', { entitled: false })).toEqual([]);
    expect(getCachedQuotesByAuthor).not.toHaveBeenCalled();
  });
});
