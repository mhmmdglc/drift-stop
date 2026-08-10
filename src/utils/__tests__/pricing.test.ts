/// <reference types="jest" />
import { buildPaywallPricing, formatMoney, formatPercent, type PricedProduct } from '../pricing';

// Bugünkü mağaza fiyatları — testin BEKLENTİSİ, ürünün sabiti değil.
const usdMonthly: PricedProduct = { price: 3.99, currencyCode: 'USD' };
const usdAnnual: PricedProduct = { price: 35.99, currencyCode: 'USD' };

describe('formatMoney', () => {
  it('formats with the store currency, not a fixed symbol', () => {
    const usd = formatMoney(47.88, 'USD', 'en');
    expect(usd).toContain('47');
    expect(usd).toContain('$');

    const tryy = formatMoney(2759.88, 'TRY', 'tr');
    expect(tryy).not.toContain('$');
    expect(tryy).toMatch(/₺|TRY/);
  });

  it('falls back to an honest "amount CODE" when Intl cannot format', () => {
    const original = Intl.NumberFormat;
    // @ts-expect-error test amacıyla Intl bozuluyor (Hermes'te olabilecek durum)
    Intl.NumberFormat = () => {
      throw new Error('no ICU');
    };
    try {
      expect(formatMoney(47.88, 'USD', 'en')).toBe('47.88 USD');
    } finally {
      Intl.NumberFormat = original;
    }
  });
});

describe('formatPercent', () => {
  it('puts the percent sign where the language puts it', () => {
    // Türkçede işaret sayının ÖNÜNDE, İngilizcede arkasında.
    expect(formatPercent(24, 'tr')).toBe('%24');
    expect(formatPercent(24, 'en')).toBe('24%');
  });

  it('falls back to a plain suffix when Intl cannot format', () => {
    const original = Intl.NumberFormat;
    // @ts-expect-error test amacıyla Intl bozuluyor
    Intl.NumberFormat = () => {
      throw new Error('no ICU');
    };
    try {
      expect(formatPercent(24, 'tr')).toBe('24%');
    } finally {
      Intl.NumberFormat = original;
    }
  });
});

describe('buildPaywallPricing', () => {
  it('derives per-week figures for both plans', () => {
    const p = buildPaywallPricing(usdMonthly, usdAnnual, 'en');
    // 3.99 * 12 / 52 = 0.9207…  ve  35.99 / 52 = 0.6921…
    expect(p.monthlyPerWeek).toContain('0.92');
    expect(p.annualPerWeek).toContain('0.69');
  });

  it('derives the annual per-month equivalent', () => {
    const p = buildPaywallPricing(usdMonthly, usdAnnual, 'en');
    expect(p.annualPerMonth).toContain('3.00');
  });

  it('compares against monthly x 12 and rounds the saving down', () => {
    const p = buildPaywallPricing(usdMonthly, usdAnnual, 'en');
    expect(p.comparison?.annualizedMonthly).toContain('47.88');
    // Gerçek oran %24.83 — yukarı yuvarlansa %25 olurdu, bu bir yalan olurdu.
    expect(p.comparison?.savingPercent).toBe(24);
    expect(p.comparison?.savingPercentText).toBe('24%');
  });

  it('never rounds a saving up', () => {
    // 10 * 12 = 120; 90.01 → %24.99…
    const c = buildPaywallPricing(
      { price: 10, currencyCode: 'USD' },
      { price: 90.01, currencyCode: 'USD' },
      'en'
    ).comparison;
    expect(c?.savingPercent).toBe(24);
  });

  it('keeps an exact percentage exact', () => {
    const c = buildPaywallPricing(
      { price: 10, currencyCode: 'USD' },
      { price: 90, currencyCode: 'USD' },
      'en'
    ).comparison;
    expect(c?.savingPercent).toBe(25);
  });

  it('works in any currency, with no dollar assumption', () => {
    const p = buildPaywallPricing(
      { price: 229.99, currencyCode: 'TRY' },
      { price: 1999.99, currencyCode: 'TRY' },
      'tr'
    );
    expect(p.comparison?.savingPercent).toBe(27); // 2759.88 → 1999.99 = %27.53
    expect(p.comparison?.annualizedMonthly).not.toContain('$');
    expect(p.monthlyPerWeek).not.toContain('$');
  });

  it('shows no comparison when the monthly package is missing', () => {
    const p = buildPaywallPricing(undefined, usdAnnual, 'en');
    expect(p.comparison).toBeNull();
    expect(p.monthlyPerWeek).toBeNull();
    // Yıllığın kendi türetilmiş fiyatları hâlâ gösterilebilir — taban uydurmuyor.
    expect(p.annualPerWeek).toContain('0.69');
  });

  it('shows no comparison when the annual package is missing', () => {
    const p = buildPaywallPricing(usdMonthly, null, 'en');
    expect(p.comparison).toBeNull();
    expect(p.annualPerWeek).toBeNull();
    expect(p.annualPerMonth).toBeNull();
    expect(p.monthlyPerWeek).toContain('0.92');
  });

  it('shows no saving when the annual is not cheaper', () => {
    expect(
      buildPaywallPricing(usdMonthly, { price: 47.88, currencyCode: 'USD' }, 'en').comparison
    ).toBeNull();
    expect(
      buildPaywallPricing(usdMonthly, { price: 59.99, currencyCode: 'USD' }, 'en').comparison
    ).toBeNull();
  });

  it('shows no saving when it would round down to zero percent', () => {
    // 47.88 → 47.60 = %0.58
    expect(
      buildPaywallPricing(usdMonthly, { price: 47.6, currencyCode: 'USD' }, 'en').comparison
    ).toBeNull();
  });

  it('refuses to compare two different currencies', () => {
    const p = buildPaywallPricing(usdMonthly, { price: 35.99, currencyCode: 'EUR' }, 'en');
    expect(p.comparison).toBeNull();
    expect(p.monthlyPerWeek).toContain('0.92');
    expect(p.annualPerWeek).toBeTruthy();
  });

  it('ignores unusable prices instead of rendering NaN', () => {
    const nan = buildPaywallPricing(
      { price: Number.NaN, currencyCode: 'USD' },
      usdAnnual,
      'en'
    );
    expect(nan.monthlyPerWeek).toBeNull();
    expect(nan.comparison).toBeNull();

    const zero = buildPaywallPricing(usdMonthly, { price: 0, currencyCode: 'USD' }, 'en');
    expect(zero.annualPerWeek).toBeNull();
    expect(zero.comparison).toBeNull();

    const noCurrency = buildPaywallPricing(usdMonthly, { price: 35.99, currencyCode: '' }, 'en');
    expect(noCurrency.annualPerWeek).toBeNull();
    expect(noCurrency.comparison).toBeNull();
  });
});
