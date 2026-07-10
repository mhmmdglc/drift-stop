/// <reference types="jest" />
import { Share } from 'react-native';

import { shareQuote } from '../share';
import i18n from '@/i18n';
import type { Quote } from '@/types/quote';

const mockShare = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });

const quote: Quote = {
  id: 1,
  text: 'Most folks are about as happy as they make up their minds to be.',
  textTr: 'İnsanlar genellikle olmaya karar verdikleri kadar mutludur.',
  author: 'Abraham Lincoln',
  origin: 'ABD',
  originEmoji: '🇺🇸',
  category: 'wisdom',
  era: 'modern',
  tags: ['wisdom'],
};

beforeEach(() => {
  mockShare.mockClear();
  i18n.locale = 'en';
});

describe('shareQuote', () => {
  it('interpolates the quote and author into the template — no "[missing ... value]" placeholders', async () => {
    await shareQuote(quote);

    expect(mockShare).toHaveBeenCalledTimes(1);
    const { message } = mockShare.mock.calls[0][0];
    expect(message).not.toMatch(/missing/i);
    expect(message).not.toContain('{{');
    expect(message).toContain(quote.text);
    expect(message).toContain(quote.author);
    expect(message).toContain('DriftStop');
  });

  it('uses the Turkish text when locale is tr', async () => {
    i18n.locale = 'tr';

    await shareQuote(quote);

    const { message } = mockShare.mock.calls[0][0];
    expect(message).toContain(quote.textTr);
  });

  it('swallows Share.share rejection (user cancelled)', async () => {
    mockShare.mockRejectedValueOnce(new Error('cancelled'));

    await expect(shareQuote(quote)).resolves.toBeUndefined();
  });
});
