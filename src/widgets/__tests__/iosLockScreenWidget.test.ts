// jest.mock fabrikası yalnız `mock` önekli değişkenlere erişebiliyor.
const mockSet = jest.fn();
const mockReload = jest.fn();
jest.mock(
  '@bacons/apple-targets',
  () => ({
    ExtensionStorage: Object.assign(
      class {
        set = mockSet;
      },
      { reloadWidget: mockReload }
    ),
  }),
  { virtual: true }
);
jest.mock('@/utils/runtime', () => ({ nativeFeaturesAvailable: true, isExpoGo: false }));

import { Platform } from 'react-native';

import { QUOTES } from '@/data/quotes';
import { APP_GROUP, LAST_QUOTE_KEY, updateIosWidgetWithQuote } from '../updateIosWidget';

const ID = QUOTES[0].id;

function setPlatform(os: string) {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
}

beforeEach(() => jest.clearAllMocks());

describe('iOS kilit ekranı widget köprüsü', () => {
  it('sözü App Group üzerinden yazar ve widget zaman çizelgesini yeniler', async () => {
    setPlatform('ios');
    await updateIosWidgetWithQuote(ID);

    expect(mockSet).toHaveBeenCalledTimes(1);
    const [key, payload] = mockSet.mock.calls[0];
    expect(key).toBe(LAST_QUOTE_KEY);
    const obj = JSON.parse(payload);
    expect(obj.id).toBe(ID);
    expect(typeof obj.text).toBe('string');
    expect(obj.text.length).toBeGreaterThan(0);
    // Yazılmadan yenilenirse widget bir öncekini gösterir.
    expect(mockReload).toHaveBeenCalled();
  });

  it('Android tarafında hiçbir şey yapmaz', async () => {
    setPlatform('android');
    await updateIosWidgetWithQuote(ID);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('bilinmeyen söz kimliğinde yazmaz', async () => {
    setPlatform('ios');
    await updateIosWidgetWithQuote(-1);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('App Group kimliği Swift eklentisindekiyle aynı', () => {
    const swift = require('fs').readFileSync(
      require('path').join(__dirname, '../../../targets/quote/index.swift'),
      'utf8'
    );
    // Eşleşmezse eklenti sessizce boş okur — hata vermez, sadece yedek söz görünür.
    expect(swift).toContain(`"${APP_GROUP}"`);
    expect(swift).toContain(`"${LAST_QUOTE_KEY}"`);
    const app = require('../../../app.json');
    expect(app.expo.ios.entitlements['com.apple.security.application-groups']).toContain(APP_GROUP);
  });

  it('kilit ekranı ailesi Swift tarafında destekleniyor', () => {
    const swift = require('fs').readFileSync(
      require('path').join(__dirname, '../../../targets/quote/index.swift'),
      'utf8'
    );
    expect(swift).toContain('.accessoryRectangular');
  });
});
