/// <reference types="jest" />
// Node tipleri projede global olarak açık değil; `.env.example` okuyan tek yer burası.
/// <reference types="node" />
import fs from 'node:fs';
import path from 'node:path';

import { googleSignInAvailableFor, isAppleRelayEmail } from '@/lib/socialAuth';

/**
 * Sosyal giriş görünürlük kapıları.
 *
 * Buradaki tek kural şu: BASINCA ÇALIŞMAYACAK bir düğme hiç gösterilmemeli.
 * Android'de Google OAuth istemcisi yokken düğme görünüyordu ve dokunan herkes
 * `DEVELOPER_ERROR` alıp ekranda yalnızca genel hata satırını görüyordu.
 */

const WEB = '591923071526-web.apps.googleusercontent.com';
const IOS = '591923071526-ios.apps.googleusercontent.com';
const ANDROID = '591923071526-android.apps.googleusercontent.com';

describe('googleSignInAvailableFor', () => {
  it('shows the button on iOS only when both the web and iOS client ids exist', () => {
    expect(googleSignInAvailableFor('ios', { web: WEB, ios: IOS, android: '' })).toBe(true);
    // iOS kimliği olmadan yerel akış hiç başlamıyor.
    expect(googleSignInAvailableFor('ios', { web: WEB, ios: '', android: ANDROID })).toBe(false);
  });

  it('hides the button on Android until an Android OAuth client is configured', () => {
    expect(googleSignInAvailableFor('android', { web: WEB, ios: IOS, android: '' })).toBe(false);
    expect(googleSignInAvailableFor('android', { web: WEB, ios: '', android: ANDROID })).toBe(true);
  });

  it('hides the button everywhere without the web client id (Supabase audience)', () => {
    expect(googleSignInAvailableFor('ios', { web: '', ios: IOS, android: ANDROID })).toBe(false);
    expect(googleSignInAvailableFor('android', { web: '', ios: IOS, android: ANDROID })).toBe(false);
  });

  it('hides the button on platforms we never configured', () => {
    expect(googleSignInAvailableFor('web', { web: WEB, ios: IOS, android: ANDROID })).toBe(false);
  });
});

describe('isAppleRelayEmail', () => {
  it('recognises Hide My Email relay addresses', () => {
    expect(isAppleRelayEmail('abc123@privaterelay.appleid.com')).toBe(true);
    expect(isAppleRelayEmail('  ABC123@PrivateRelay.AppleID.com  ')).toBe(true);
  });

  it('leaves real addresses alone', () => {
    expect(isAppleRelayEmail('someone@icloud.com')).toBe(false);
    expect(isAppleRelayEmail(null)).toBe(false);
    expect(isAppleRelayEmail(undefined)).toBe(false);
  });
});

describe('.env.example', () => {
  it('documents the Android client id that gates the Android button', () => {
    const file = fs.readFileSync(path.resolve(__dirname, '../../../.env.example'), 'utf8');

    // Kapı veriye bağlı: Android'i açmak bir yapılandırma değişikliği olmalı,
    // kod değişikliği değil — ama ancak değişkenin varlığı belgeliyse.
    expect(file).toMatch(/^EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=/m);
  });
});
