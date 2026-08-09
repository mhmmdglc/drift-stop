/// <reference types="jest" />

/**
 * `/auth` ekranının sosyal giriş sonucu davranışı.
 *
 * Cihazda görülen hata: Google hesap seçicisini "İptal" ile kapatan kullanıcı
 * için ekran KAPANIYOR, kullanıcı hiçbir açıklama olmadan misafir olarak
 * Ayarlar'a düşüyordu. Sebep çağrı yerindeydi: iptal de başarı da `error: null`
 * dönüyordu. Bu dosya üç sonucun üçünü de sabitler — iptalde ekran açık kalmalı,
 * gerçek hata satırı görünmeli, gerçek başarı ekranı kapatmalı.
 */

/**
 * `SketchButton` (e-posta gönder düğmesi) Reanimated'ı içeri çekiyor; Worklets'in
 * yerel parçası Jest'te yok ve modül import anında patlıyor. Bu testin konusu
 * mürekkep-damgası animasyonu değil, sosyal giriş sonucunun ne yaptığı — düğme
 * sade bir `Pressable` ile değiştiriliyor.
 */
jest.mock('@/components/SketchButton', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    SketchButton: ({
      label,
      onPress,
      disabled,
    }: {
      label: string;
      onPress: () => void;
      disabled?: boolean;
    }) =>
      React.createElement(
        Pressable,
        { onPress, disabled, accessibilityRole: 'button', accessibilityLabel: label },
        React.createElement(Text, null, label)
      ),
  };
});

const mockSignInWithProvider = jest.fn();
const mockBack = jest.fn();

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    signInWithEmail: jest.fn(),
    signUpWithEmail: jest.fn(),
    resendConfirmation: jest.fn(),
    sendPasswordReset: jest.fn(),
    signInWithProvider: mockSignInWithProvider,
  }),
}));
jest.mock('@/lib/socialAuth', () => ({
  googleSignInAvailable: true,
  // Apple düğmesi yerel bir iOS bileşeni; bu testin konusu değil.
  appleSignInAvailable: () => Promise.resolve(false),
}));
jest.mock('@/i18n/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'en' }),
}));
jest.mock('@/hooks/use-theme', () => {
  const { DarkColors } = require('@/constants/colors');
  return { useTheme: () => ({ colors: DarkColors, themeName: 'dark', mode: 'dark' }) };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, canGoBack: () => true, push: jest.fn() }),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import AuthScreen from '@/app/auth';

const GOOGLE_BUTTON = 'auth.continueWithGoogle';

async function pressGoogle() {
  await render(<AuthScreen />);
  await act(async () => {
    fireEvent.press(screen.getByLabelText(GOOGLE_BUTTON));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('/auth — social sign-in outcomes', () => {
  it('stays open and silent when the user cancels the provider sheet', async () => {
    mockSignInWithProvider.mockResolvedValue({ error: null, cancelled: true });

    await pressGoogle();

    // Ekran kapanmamalı...
    expect(mockBack).not.toHaveBeenCalled();
    // ...hata satırı da çıkmamalı: vazgeçmek hata değil.
    expect(screen.queryByText(/auth\.errors\./)).toBeNull();
    // ...ve düğme yeniden basılabilir olmalı (busy takılı kalmasın).
    expect(screen.getByLabelText(GOOGLE_BUTTON).props.accessibilityState).toMatchObject({
      disabled: false,
      busy: false,
    });
  });

  it('shows the error line and stays open when sign-in really fails', async () => {
    mockSignInWithProvider.mockResolvedValue({ error: 'auth.errors.playServices' });

    await pressGoogle();

    expect(screen.getByText('auth.errors.playServices')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('closes the screen on a real sign-in', async () => {
    mockSignInWithProvider.mockResolvedValue({ error: null });

    await pressGoogle();

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/auth\.errors\./)).toBeNull();
  });
});
