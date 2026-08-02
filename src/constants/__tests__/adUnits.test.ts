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

  it.failing('iOS app id Google’ın ÖRNEK id’si değil', () => {
    // BİLEREK `it.failing`: `app.json:iosAppId` şu an hâlâ Google'ın örnek
    // yayıncı id'si. AdMob hesabı kapatıldığı için gerçek bir iOS id'si YOK ve
    // uydurulamaz. Bu test, gerçek id girildiği gün kendiliğinden "beklenmedik
    // şekilde geçti" diye patlar ve `it.failing` kaldırılır — yani yapılacak iş
    // sessizce unutulamaz. iOS App Store'a gönderim öncesi kapatılması ZORUNLU.
    expect(ads?.iosAppId ?? '').not.toContain(GOOGLE_SAMPLE_APP_ID);
  });
});
