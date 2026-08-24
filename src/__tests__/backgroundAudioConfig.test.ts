/// <reference types="jest" />
/// <reference types="node" />
import fs from 'node:fs';
import path from 'node:path';

/**
 * Arka plan sesi bekçisi.
 *
 * iOS 1.2.0 (build 8) **App Review'dan Guideline 2.5.4 ile reddedildi**:
 *
 *   "The app declares support for audio in the UIBackgroundModes key in your
 *    Info.plist but we are unable to play any audible content when the app is
 *    running in the background."
 *
 * Haklıydılar. `app.json` `UIBackgroundModes` yazmıyordu; anahtarı binary'ye
 * `expo-audio` config plugin'i koyuyordu. Eklenti düz string (`"expo-audio"`)
 * olarak kaydedilince **`enableBackgroundPlayback` varsayılanı `true`** oluyor
 * ve `audio` modunu ekliyor — üstelik paket uygulamada hiç kullanılmıyordu.
 * `tsc` de testler de sessizdi; ilk uyarı reddin kendisiydi.
 *
 * Buradaki testler o sessiz sapmayı gürültülü hale getiriyor. Uygulama
 * gerçekten arka planda ses çalmaya başlarsa bu dosya bilerek güncellenmeli —
 * ama o zaman Apple'a gösterilecek çalışan bir arka plan sesi de olmalı.
 */

const ROOT = path.resolve(__dirname, '../..');

type PluginEntry = string | [string, Record<string, unknown>?];

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')) as T;
}

const appConfig = () =>
  readJson<{
    expo: { plugins: PluginEntry[]; ios?: { infoPlist?: Record<string, unknown> } };
  }>('app.json').expo;

const packageJson = () =>
  readJson<{ dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>(
    'package.json'
  );

describe('background audio is never declared', () => {
  it('does not ask for the audio background mode in app.json', () => {
    const modes = appConfig().ios?.infoPlist?.UIBackgroundModes;

    // Anahtarın hiç olmaması da geçerli; olacaksa içinde `audio` olmamalı.
    expect(Array.isArray(modes) ? (modes as string[]) : []).not.toContain('audio');
  });

  it('registers no config plugin that turns the audio background mode on', () => {
    // `expo-audio` bir kez daha eklenirse SEÇENEKLERİYLE eklenmeli:
    // ["expo-audio", { "enableBackgroundPlayback": false }].
    // Düz string hâli varsayılanı (`true`) uygulayıp `audio` modunu geri getirir.
    for (const entry of appConfig().plugins) {
      const name = Array.isArray(entry) ? entry[0] : entry;
      if (name !== 'expo-audio') continue;

      const options = Array.isArray(entry) ? entry[1] : undefined;
      expect(options?.enableBackgroundPlayback).toBe(false);
      expect(options?.enableBackgroundRecording ?? false).toBe(false);
    }
  });

  it('does not depend on expo-audio at all — nothing in the app plays sound', () => {
    const pkg = packageJson();

    expect(pkg.dependencies?.['expo-audio']).toBeUndefined();
    expect(pkg.devDependencies?.['expo-audio']).toBeUndefined();
  });
});
