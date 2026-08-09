import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

/**
 * Google ve Apple ile giriş.
 *
 * İkisi de **yerel (native) akış** kullanıyor, tarayıcı üzerinden OAuth değil:
 * kullanıcı uygulamadan çıkmıyor, sistem hesap seçicisi açılıyor. Her iki
 * sağlayıcı da bize bir `idToken` veriyor, onu Supabase'e
 * `signInWithIdToken` ile veriyoruz. Bu yüzden Supabase tarafında
 * sağlayıcıya "client id" tanıtmak yeterli — istemci sırrı (secret) gerekmiyor.
 *
 * ⚠️ Apple girişi **yalnızca iOS**'ta var (`expo-apple-authentication` Android'i
 * desteklemiyor) ve Apple da zaten sadece iOS'ta zorunlu tutuyor. Android'de
 * düğme hiç gösterilmiyor — çalışmayan bir düğme koymak yanıltıcı olurdu.
 */

/** Google istemci kimlikleri build anında gömülür (EXPO_PUBLIC_*, bkz. adUnits.ts notu). */
const GOOGLE_WEB_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim();
const GOOGLE_IOS_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '').trim();
/**
 * Android istemci kimliği uygulama tarafından HİÇ okunmuyor — Google, Android'de
 * eşleşmeyi paket adı + imza SHA-1'i üzerinden yapar. Buradaki tek işlevi
 * "Google Cloud'da bir Android istemcisi gerçekten var mı" sorusunun cevabını
 * derlemeye taşımak: istemci yokken düğmeye basan herkes `DEVELOPER_ERROR`
 * alıyor ve ekranda yalnızca genel hata satırını görüyor.
 */
const GOOGLE_ANDROID_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '').trim();

/**
 * Google girişi bu platformda GERÇEKTEN çalışabilir mi.
 *
 * Kural platforma sabitlenmiş değil, veriye bakıyor: eksik kimlik ⇒ düğme yok.
 * Android'i açmak bu yüzden bir kod değişikliği değil, bir yapılandırma
 * değişikliği (`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` + EAS bulut ortamı).
 *
 * - Her yerde WEB kimliği şart: Supabase `signInWithIdToken`'ın doğruladığı
 *   "audience" o.
 * - iOS'ta ayrıca IOS kimliği şart: onsuz yerel akış hiç başlamıyor.
 * - Android'de ayrıca ANDROID kimliği şart: yoksa akış `DEVELOPER_ERROR` ile
 *   ölüyor. Basınca hata veren düğme, hiç olmamasından kötü.
 */
export function googleSignInAvailableFor(
  os: string,
  ids: { web: string; ios: string; android: string }
): boolean {
  if (ids.web.length === 0) return false;
  if (os === 'ios') return ids.ios.length > 0;
  if (os === 'android') return ids.android.length > 0;
  return false;
}

export const googleSignInAvailable = googleSignInAvailableFor(Platform.OS, {
  web: GOOGLE_WEB_CLIENT_ID,
  ios: GOOGLE_IOS_CLIENT_ID,
  android: GOOGLE_ANDROID_CLIENT_ID,
});

export type SocialCredential = {
  provider: 'google' | 'apple';
  idToken: string;
  /** Apple yalnızca İLK girişte ad veriyor; sonraki girişlerde null. */
  fullName?: string | null;
};

export type SocialError =
  | { cancelled: true }
  | { cancelled?: false; reason: 'unavailable' | 'noToken' | 'playServices' | 'error' };

/** Google Sign-In SDK'sı yalnızca gerektiğinde yükleniyor — açılış süresini uzatmasın. */
async function googleModule() {
  return import('@react-native-google-signin/google-signin');
}

let googleConfigured = false;

export async function signInWithGoogle(): Promise<SocialCredential | SocialError> {
  if (!googleSignInAvailable) return { reason: 'unavailable' };
  // Kod sabitleri SDK'dan geliyor (platforma göre değişiyorlar); catch bloğunda
  // da lazım olduğu için try'ın dışında tutuluyor.
  let statusCodesRef:
    | { SIGN_IN_CANCELLED: string; IN_PROGRESS: string; PLAY_SERVICES_NOT_AVAILABLE: string }
    | undefined;
  try {
    const { GoogleSignin, statusCodes } = await googleModule();
    statusCodesRef = statusCodes;

    if (!googleConfigured) {
      // webClientId Supabase'in doğrulayacağı "audience"; iosClientId olmadan
      // iOS'ta yerel akış başlamıyor.
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
      });
      googleConfigured = true;
    }

    // Play Services kontrolü ayrı yakalanıyor: eksik/eski Play Services'ta
    // kullanıcı "bir şeyler ters gitti" değil, ne yapacağını söyleyen bir satır
    // görmeli. (iOS'ta bu çağrı zaten her zaman başarılı dönüyor.)
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    } catch {
      return { reason: 'playServices' };
    }

    const result = await GoogleSignin.signIn();

    // v13+ yanıtı {type, data} sarmalıyor; eski sürümlerde düz nesne geliyordu.
    const anyResult = result as unknown as {
      type?: string;
      data?: { idToken?: string | null };
      idToken?: string | null;
    };
    if (anyResult.type === 'cancelled') return { cancelled: true };

    const idToken = anyResult.data?.idToken ?? anyResult.idToken ?? null;
    if (!idToken) return { reason: 'noToken' };

    return { provider: 'google', idToken };
  } catch (e) {
    const code = (e as { code?: string })?.code;
    // SIGN_IN_CANCELLED / -5 (iOS) → kullanıcı vazgeçti, hata gösterme.
    // IN_PROGRESS de sessiz: hesap seçici zaten açık, ekrana kırmızı yazı basmak yanıltır.
    if (
      code === '-5' ||
      code === 'SIGN_IN_CANCELLED' ||
      code === '12501' ||
      code === statusCodesRef?.SIGN_IN_CANCELLED ||
      code === statusCodesRef?.IN_PROGRESS
    ) {
      return { cancelled: true };
    }
    if (code === statusCodesRef?.PLAY_SERVICES_NOT_AVAILABLE) return { reason: 'playServices' };
    return { reason: 'error' };
  }
}

/** Apple düğmesi yalnızca iOS'ta ve cihaz destekliyorsa gösterilmeli. */
export async function appleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithApple(): Promise<SocialCredential | SocialError> {
  if (Platform.OS !== 'ios') return { reason: 'unavailable' };
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) return { reason: 'noToken' };

    // Ad YALNIZCA ilk yetkilendirmede geliyor; sonraki girişlerde alanlar null.
    // Boş bir ad `null` olarak dönmeli: "" yazarsak çağıran taraf kayıtlı adı
    // boşla ezer ve ad bir daha asla geri gelmez.
    const name = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return {
      provider: 'apple',
      idToken: credential.identityToken,
      fullName: name.length > 0 ? name : null,
    };
  } catch (e) {
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return { cancelled: true };
    return { reason: 'error' };
  }
}

export function isSocialError(v: SocialCredential | SocialError): v is SocialError {
  return !('provider' in v);
}

/** Apple'ın "E-postamı Gizle" yönlendirme alan adı. */
const APPLE_RELAY_DOMAIN = '@privaterelay.appleid.com';

/**
 * Adres Apple'ın gizli yönlendirme adresi mi.
 * Ekranda `a1b2c3d4@privaterelay.appleid.com` gibi bir şey gören kullanıcı bunu
 * bozuk veri sanıyor; hesap ekranı bu sayede tek satırlık bir açıklama koyabiliyor.
 */
export function isAppleRelayEmail(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase().endsWith(APPLE_RELAY_DOMAIN);
}
