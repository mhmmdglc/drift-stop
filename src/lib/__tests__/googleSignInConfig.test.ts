/// <reference types="jest" />
// Node tipleri projede global olarak açık değil (tsconfig React Native tarafına
// ayarlı); bu test dosya sistemine bakan tek yer, o yüzden referansı burada veriyoruz.
/// <reference types="node" />
import fs from 'node:fs';
import path from 'node:path';

/**
 * Google girişinin iOS yapılandırma bekçisi.
 *
 * Bu proje bir kez, üç Play derlemesini backend yapılandırması olmadan
 * yayınladı: eksik yapılandırma hata vermez, sadece sessizce hiçbir şey yapmaz.
 * `app.json`'daki Google eklentisi tam olarak bu şekilde bozuldu — eklenti
 * seçeneksiz (düz string) kaydedilmişti, bu yüzden `iosUrlScheme` hiç
 * üretilmedi, `CFBundleURLSchemes` içine ters çevrilmiş istemci kimliği
 * girmedi ve iOS'ta Google girişi uygulamaya geri dönemedi. Ne prebuild ne
 * de tip kontrolü şikayet etti.
 *
 * Buradaki testler o sessiz sapmayı gürültülü hale getiriyor:
 * `iosUrlScheme` ile `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` birbirinden ayrılırsa
 * (biri döndürülür, diğeri unutulursa) CI kırmızıya döner.
 */

const ROOT = path.resolve(__dirname, '../../..');
const GOOGLE_PLUGIN = '@react-native-google-signin/google-signin';
const IOS_CLIENT_ID_VAR = 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID';
const WEB_CLIENT_ID_VAR = 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID';

type PluginEntry = string | [string, Record<string, unknown>?];

function readAppConfig(): { expo: { plugins: PluginEntry[] } } {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
}

function findGooglePlugin(): PluginEntry | undefined {
  return readAppConfig().expo.plugins.find((entry) =>
    Array.isArray(entry) ? entry[0] === GOOGLE_PLUGIN : entry === GOOGLE_PLUGIN
  );
}

/**
 * Google'ın iOS geri dönüş şeması, istemci kimliğinin ters çevrilmiş hali:
 * `<id>.apps.googleusercontent.com` → `com.googleusercontent.apps.<id>`.
 */
function reverseClientId(clientId: string): string {
  return `com.googleusercontent.apps.${clientId.replace(/\.apps\.googleusercontent\.com$/, '')}`;
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

/**
 * İstemci kimliğinin bulunabileceği her yer. `.env` gitignore'lu ve jest onu
 * yüklemiyor (jest-expo `.env` okumaz), bu yüzden CI'da tek kaynak
 * `.env.example` oluyor — kimliğin oraya da yazılmasının sebebi bu.
 * Tanımlı olan HER kaynak şemayla uyuşmak zorunda: birini güncelleyip
 * diğerini unutmak da bir sapmadır.
 */
function iosClientIdSources(): { label: string; value: string }[] {
  const candidates: { label: string; value: string | undefined }[] = [
    { label: 'process.env', value: process.env[IOS_CLIENT_ID_VAR] },
    { label: '.env', value: parseEnvFile('.env')[IOS_CLIENT_ID_VAR] },
    { label: '.env.example', value: parseEnvFile('.env.example')[IOS_CLIENT_ID_VAR] },
  ];
  return candidates.flatMap(({ label, value }) => {
    const trimmed = (value ?? '').trim();
    return trimmed.length > 0 ? [{ label, value: trimmed }] : [];
  });
}

describe('Google sign-in iOS config', () => {
  it('registers the config plugin WITH options, not as a bare string', () => {
    const entry = findGooglePlugin();

    expect(entry).toBeDefined();
    // Düz string olarak kaydetmek eklentiyi Firebase moduna sokuyor
    // (google-services dosyası bekliyor) ve hiçbir URL şeması üretmiyor.
    expect(Array.isArray(entry)).toBe(true);

    const options = (entry as [string, Record<string, unknown>?])[1];
    expect(typeof options).toBe('object');
    expect(typeof options?.iosUrlScheme).toBe('string');
    expect((options?.iosUrlScheme as string).startsWith('com.googleusercontent.apps.')).toBe(true);
  });

  it(`iosUrlScheme matches the reversed ${IOS_CLIENT_ID_VAR} in every source that defines it`, () => {
    const entry = findGooglePlugin() as [string, Record<string, unknown>];
    const scheme = entry[1].iosUrlScheme as string;
    const sources = iosClientIdSources();

    // Hiç kaynak bulunamazsa test sessizce "geçmemeli" — bekçiyi kapatmak olurdu.
    if (sources.length === 0) {
      throw new Error(
        `${IOS_CLIENT_ID_VAR} is not defined in process.env, .env or .env.example, ` +
          'so the iosUrlScheme divergence guard could not verify anything.'
      );
    }

    for (const source of sources) {
      expect({ source: source.label, scheme: reverseClientId(source.value) }).toEqual({
        source: source.label,
        scheme,
      });
    }
  });

  it('.env.example documents both Google client id variables', () => {
    const example = parseEnvFile('.env.example');

    expect(Object.keys(example)).toEqual(expect.arrayContaining([WEB_CLIENT_ID_VAR, IOS_CLIENT_ID_VAR]));
  });
});
