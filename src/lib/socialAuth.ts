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
 * Google girişi bu derlemede kullanılabilir mi.
 * Kimlik yoksa düğme GİZLENİR — basınca hata veren bir düğme, hiç olmamasından kötü.
 */
export const googleSignInAvailable = GOOGLE_WEB_CLIENT_ID.length > 0;

export type SocialCredential = {
  provider: 'google' | 'apple';
  idToken: string;
  /** Apple yalnızca İLK girişte ad veriyor; sonraki girişlerde null. */
  fullName?: string | null;
};

export type SocialError =
  | { cancelled: true }
  | { cancelled?: false; reason: 'unavailable' | 'noToken' | 'error' };

/** Google Sign-In SDK'sı yalnızca gerektiğinde yükleniyor — açılış süresini uzatmasın. */
async function googleModule() {
  return import('@react-native-google-signin/google-signin');
}

let googleConfigured = false;

export async function signInWithGoogle(): Promise<SocialCredential | SocialError> {
  if (!googleSignInAvailable) return { reason: 'unavailable' };
  try {
    const { GoogleSignin, statusCodes } = await googleModule();

    if (!googleConfigured) {
      // webClientId Supabase'in doğrulayacağı "audience"; iosClientId olmadan
      // iOS'ta yerel akış başlamıyor.
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
      });
      googleConfigured = true;
    }

    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
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
    if (code === '-5' || code === 'SIGN_IN_CANCELLED' || code === '12501') return { cancelled: true };
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
