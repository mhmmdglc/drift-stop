/// <reference types="jest" />
/// <reference types="node" />
import fs from 'node:fs';
import path from 'node:path';

/**
 * `process.env` yalnızca STATİK okunur.
 *
 * `babel-preset-expo`, `EXPO_PUBLIC_*` değerlerini derleme anında pakete gömerken
 * sadece **statik üye erişimini** (`process.env.EXPO_PUBLIC_FOO`) tanır.
 * Hesaplanmış erişim (`process.env[key]`) dönüştürülmez ve cihazda `process.env`
 * diye bir nesne olmadığı için değer `undefined` kalır.
 *
 * Bu, projenin en pahalı sessiz hatasıydı: `constants/adUnits.ts` dört reklam
 * birimini `process.env[key]` ile okuyordu, dolayısıyla **hiçbir yayın derlemesi
 * tek bir reklam bile gösteremezdi** — yanlış AdMob hesabından da bağımsız
 * olarak. Hiçbir gösterge bunu söylemiyordu: `tsc` temiz, testler yeşil (jest
 * gerçek `process.env`i okuduğu için iki yazım da çalışır), EAS build logu
 * değişkenleri "yüklendi" diye yazıyordu. Ancak `.aab` içindeki Hermes paketinde
 * birim id'lerinin **hiç geçmediği** görülünce ortaya çıktı (2026-08-24).
 *
 * Bu test o yazımı kaynakta yasaklıyor. Testler bu hatayı çalıştırarak
 * yakalayamaz; yakalayabilecek tek yer kaynağın kendisi.
 */

const SRC = path.resolve(__dirname, '..');
const DYNAMIC_ENV = /process\s*\.\s*env\s*\[/;

/** Yorumlar sayılmıyor — bu tuzağı ANLATAN yorumlar da `process.env[...]` yazıyor. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Testler jest altında koşuyor, orada `process.env` gerçekten var.
      return entry.name === '__tests__' ? [] : sourceFiles(full);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe('EXPO_PUBLIC_* values are read in a form Babel can inline', () => {
  it('never reads process.env with a computed key in app source', () => {
    const offenders = sourceFiles(SRC).filter((file) =>
      DYNAMIC_ENV.test(stripComments(fs.readFileSync(file, 'utf8')))
    );

    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it('reads every ad unit variable by its literal name', () => {
    const source = fs.readFileSync(path.join(SRC, 'constants/adUnits.ts'), 'utf8');

    for (const name of [
      'EXPO_PUBLIC_ADMOB_BANNER_ANDROID',
      'EXPO_PUBLIC_ADMOB_BANNER_IOS',
      'EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID',
      'EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS',
    ]) {
      expect({ name, static: new RegExp(`process\\.env\\.${name}\\b`).test(source) }).toEqual({
        name,
        static: true,
      });
    }
  });
});
