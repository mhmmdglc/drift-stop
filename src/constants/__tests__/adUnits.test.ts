/// <reference types="jest" />
/**
 * Reklam id'lerinin canlıya doğru şekilde gitmesini sabitler.
 *
 * Buradaki asıl risk sessiz: birim id'si eksik kalırsa eski kod Google'ın TEST
 * birimine düşüyordu, yani gerçek kullanıcılara test reklamı gösteriliyordu.
 * Bu bir AdMob politika ihlali ve hesap kapanma sebebi — bu projede zaten bir
 * kez yaşandı.
 */
import appJson from '../../../app.json';

/** Google'ın dokümanlarındaki örnek yayıncı uygulaması — canlıya ASLA gitmemeli. */
const GOOGLE_SAMPLE_APP_ID = 'ca-app-pub-3940256099942544';

describe('AdMob app id yapılandırması', () => {
  const ads = (
    appJson as unknown as {
      expo: { plugins: unknown[] };
    }
  ).expo.plugins
    .filter((p): p is [string, Record<string, string>] => Array.isArray(p))
    .find(([name]) => name === 'react-native-google-mobile-ads')?.[1];

  it('app.json içinde AdMob eklentisi yapılandırılmış', () => {
    expect(ads).toBeDefined();
  });

  it('Android app id Google’ın ÖRNEK id’si değil', () => {
    expect(ads?.androidAppId ?? '').not.toContain(GOOGLE_SAMPLE_APP_ID);
  });

  it('iOS app id Google’ın ÖRNEK id’si değil', () => {
    // Bu test bir dönem `it.failing` idi: iOS app id'si Google'ın örnek yayıncı
    // id'siydi çünkü eski AdMob hesabı kapatılmıştı ve gerçek bir id yoktu.
    // Tuzak işini yaptı — gerçek id girildiği gün "beklenmedik şekilde geçti"
    // diye patladı ve iş sessizce unutulamadı. Artık normal bir korumaya döndü:
    // örnek id'nin geri sızması build'i değil testi kırar.
    expect(ads?.iosAppId ?? '').not.toContain(GOOGLE_SAMPLE_APP_ID);
  });
});
