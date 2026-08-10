/// <reference types="jest" />
import i18n from '@/i18n';
import de from '@/locales/de.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import itLocale from '@/locales/it.json';
import tr from '@/locales/tr.json';

const ACTIVE: Record<string, unknown> = { tr, en, es, de, fr, it: itLocale };

type Json = Record<string, unknown>;

function flatten(obj: Json, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) return [`${key}[${v.length}]`];
    if (v && typeof v === 'object') return flatten(v as Json, key);
    return [key];
  });
}

function emptyValues(obj: Json, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      return (v as unknown[]).flatMap((item, i) =>
        typeof item === 'string' && item.trim() === '' ? [`${key}[${i}]`] : []
      );
    }
    if (v && typeof v === 'object') return emptyValues(v as Json, key);
    if (typeof v === 'string' && v.trim() === '') return [key];
    return [];
  });
}

describe('locale files', () => {
  const baseKeys = flatten(tr as Json).sort();

  it('all active locales share the same key structure as tr', () => {
    for (const [code, json] of Object.entries(ACTIVE)) {
      const keys = flatten(json as Json).sort();
      expect({ code, keys }).toEqual({ code, keys: baseKeys });
    }
  });

  it('all active locales have non-empty values', () => {
    for (const [code, json] of Object.entries(ACTIVE)) {
      expect({ code, empties: emptyValues(json as Json) }).toEqual({ code, empties: [] });
    }
  });

  // i18n-js'in yer tutucu deseni HEM `{{x}}` HEM `%{x}` kabul ediyor, bu yüzden
  // Türkçedeki "%{{percent}}" gibi bir yazım yer tutucuyu sessizce bozup
  // ekrana `[missing "…" value]` bastırıyor. Paywall'daki fiyat metinleri
  // gerçek i18n motorundan geçirilerek kontrol ediliyor.
  it('paywall price strings interpolate with no missing placeholders', () => {
    const options = {
      label: 'Pro',
      price: '$35.99',
      compare: '$47.88',
      perWeek: '$0.69',
      percent: '24%',
    };
    const keys = [
      'paywall.packages.savePercent',
      'paywall.packages.perWeekUnit',
      'paywall.packages.billedMonthly',
      'paywall.packages.billedAnnual',
      'paywall.packages.a11yPackage',
      'paywall.packages.a11yMonthly',
      'paywall.packages.a11yAnnual',
      'paywall.packages.a11yAnnualSaving',
    ];
    for (const code of Object.keys(ACTIVE)) {
      i18n.locale = code;
      for (const key of keys) {
        const text = i18n.t(key, options);
        expect({ code, key, text }).toEqual({
          code,
          key,
          text: expect.not.stringContaining('missing'),
        });
        expect({ code, key, text }).toEqual({
          code,
          key,
          text: expect.not.stringContaining('{{'),
        });
      }
    }
    i18n.locale = 'tr';
  });

  // Paywall'da en büyük rakam haftalık karşılık; tahsil edilen tutarın YANINDA
  // dönemi yazmazsa (yalnızca "$35.99") mağaza kuralları açısından yanıltıcı
  // olur. Çeviri sırasında dönem kelimesinin düşmesi ekranda fark edilmeyecek
  // ama incelemede takılacak bir hata — burada sabitleniyor.
  it('every locale states the billing period next to the charged amount', () => {
    for (const [code, json] of Object.entries(ACTIVE)) {
      const pkgs = (json as { paywall: { packages: Record<string, string> } }).paywall.packages;
      for (const key of ['billedMonthly', 'billedAnnual']) {
        const text = pkgs[key];
        expect({ code, key, text }).toEqual({
          code,
          key,
          text: expect.stringContaining('{{price}}'),
        });
        // Yer tutucu çıkarıldığında geriye dönemi anlatan bir metin kalmalı.
        expect({ code, key, rest: text.replace('{{price}}', '').replace(/[\s/]/g, '') }).toEqual({
          code,
          key,
          rest: expect.not.stringMatching(/^$/),
        });
      }
      // Ekran okuyucu da gerçek tahsilatı duymalı — sadece haftalık rakamı değil.
      for (const key of ['a11yMonthly', 'a11yAnnual', 'a11yAnnualSaving']) {
        expect({ code, key, text: pkgs[key] }).toEqual({
          code,
          key,
          text: expect.stringContaining('{{price}}'),
        });
        expect({ code, key, text: pkgs[key] }).toEqual({
          code,
          key,
          text: expect.stringContaining('{{perWeek}}'),
        });
      }
    }
  });

  it('share template keeps placeholders in every locale', () => {
    for (const json of Object.values(ACTIVE)) {
      const tpl = (json as { share: { quoteTemplate: string } }).share.quoteTemplate;
      expect(tpl).toContain('{{quote}}');
      expect(tpl).toContain('{{author}}');
    }
  });
});
