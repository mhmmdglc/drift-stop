/// <reference types="jest" />
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

  it('share template keeps placeholders in every locale', () => {
    for (const json of Object.values(ACTIVE)) {
      const tpl = (json as { share: { quoteTemplate: string } }).share.quoteTemplate;
      expect(tpl).toContain('{{quote}}');
      expect(tpl).toContain('{{author}}');
    }
  });
});
