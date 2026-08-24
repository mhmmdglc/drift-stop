/// <reference types="jest" />
// Node tipleri projede global olarak açık değil (tsconfig React Native tarafına
// ayarlı); bu test dosya sistemine bakıyor, referansı burada veriyoruz.
/// <reference types="node" />
import fs from 'node:fs';
import path from 'node:path';

/**
 * AdMob kimliklerinin TEK bir yayıncıya ait olması.
 *
 * Play'de canlı olan 1.2.0 (versionCode 19) **tek bir reklam göstermedi** ve
 * hiçbir şey hata vermedi: `app.json` ile `.env`'deki kimlikler
 * `pub-6963122807813930` hesabındandı, o hesap da "onaylanmadı" durumundaydı.
 * Kod doğru davrandı (`resolveUnit` gerçek id yoksa reklam basmıyor), gelir
 * sessizce sıfır kaldı. 2026-08-24'te hepsi `pub-3817081931651779`'a taşındı.
 *
 * Taşımanın yarım kalması aynı sessizliği geri getirir: uygulama kimliği bir
 * hesaptan, reklam birimi başka hesaptan olursa AdMob o birimi sunmaz. Bu test
 * "hangi hesap" diye karar vermiyor — **hepsinin aynı hesap olmasını** şart
 * koşuyor. Yayıncı değişirse `https://mgulcu.me/app-ads.txt` de değişmeli,
 * yoksa doğrulama kırılır (bkz. OPERATIONS.md).
 */

const ROOT = path.resolve(__dirname, '../../..');
const UNIT_VARS = [
  'EXPO_PUBLIC_ADMOB_BANNER_ANDROID',
  'EXPO_PUBLIC_ADMOB_BANNER_IOS',
  'EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID',
  'EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS',
] as const;

type PluginEntry = string | [string, Record<string, unknown>?];

/** `ca-app-pub-<yayıncı>~<uygulama>` ve `…/<birim>` — ikisinde de yayıncı aynı yerde. */
function publisherOf(id: string): string | null {
  return /^ca-app-pub-(\d+)[~/]\d+$/.exec(id)?.[1] ?? null;
}

function admobPluginOptions(): Record<string, unknown> {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')) as {
    expo: { plugins: PluginEntry[] };
  };
  const entry = config.expo.plugins.find(
    (p) => (Array.isArray(p) ? p[0] : p) === 'react-native-google-mobile-ads'
  );

  // Düz string kaydedilirse hiç uygulama kimliği verilmemiş demektir; SDK
  // native tarafta çöker. Eklenti her zaman seçenekleriyle durmalı.
  expect(Array.isArray(entry)).toBe(true);
  return (entry as [string, Record<string, unknown>])[1];
}

function parseEnvFile(file: string): Record<string, string> {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(abs, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    out[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

/** Kimliğin tanımlı olduğu her kaynak. `.env` gitignore'lu, CI'da yoksa atlanır. */
function unitIdSources(): { label: string; id: string }[] {
  const stores: [string, Record<string, string | undefined>][] = [
    ['process.env', process.env],
    ['.env', parseEnvFile('.env')],
    ['.env.example', parseEnvFile('.env.example')],
  ];
  return stores.flatMap(([label, store]) =>
    UNIT_VARS.flatMap((name) => {
      const id = (store[name] ?? '').trim();
      // `.env.example` değerleri kasten boş — orada aranan şey kimlik değil,
      // değişkenin belgelenmiş olması.
      return id.length > 0 ? [{ label: `${label}:${name}`, id }] : [];
    })
  );
}

describe('AdMob ids all belong to one publisher', () => {
  it('gives both platforms an app id in the plugin block', () => {
    const options = admobPluginOptions();

    for (const key of ['androidAppId', 'iosAppId'] as const) {
      expect({ key, publisher: publisherOf(String(options[key] ?? '')) }).toEqual({
        key,
        publisher: expect.stringMatching(/^\d+$/),
      });
    }
  });

  it('uses the same publisher for the Android and the iOS app id', () => {
    const options = admobPluginOptions();

    expect(publisherOf(String(options.iosAppId))).toBe(publisherOf(String(options.androidAppId)));
  });

  it('serves ad units from the publisher that owns the app ids', () => {
    const publisher = publisherOf(String(admobPluginOptions().androidAppId));
    const sources = unitIdSources();

    // Hiç kaynak yoksa test sessizce "geçmemeli" — bekçiyi kapatmak olurdu.
    if (sources.length === 0) {
      throw new Error(
        `None of ${UNIT_VARS.join(', ')} is defined in process.env, .env or .env.example, ` +
          'so the AdMob publisher guard could not verify anything.'
      );
    }

    for (const source of sources) {
      expect({ source: source.label, publisher: publisherOf(source.id) }).toEqual({
        source: source.label,
        publisher,
      });
    }
  });

  it('.env.example documents every ad unit variable', () => {
    expect(Object.keys(parseEnvFile('.env.example'))).toEqual(
      expect.arrayContaining([...UNIT_VARS])
    );
  });
});
