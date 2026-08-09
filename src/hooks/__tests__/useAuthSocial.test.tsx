/// <reference types="jest" />

/**
 * `signInWithProvider` sonucunun ÜÇ durumu ayırt edilebilir olmalı:
 * başarı, vazgeçme, hata.
 *
 * Vazgeçme ile başarı bir zamanlar ikisi de `error: null` dönüyordu; çağıran
 * ekran ikisini ayıramadığı için kullanıcı hesap seçiciyi kapattığında `/auth`
 * da kapanıyor ve misafir olarak Ayarlar'a düşüyordu (iOS cihazında görüldü).
 * Buradaki `cancelled` bayrağı o ayrımın tek kaynağı.
 */

const mockSupabase = {
  auth: {
    getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: jest.fn().mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    }),
    signInWithIdToken: jest.fn(),
    updateUser: jest.fn().mockResolvedValue({ error: null }),
  },
};

const mockSignInWithGoogle = jest.fn();
const mockSignInWithApple = jest.fn();

// Getter: `jest.mock` fabrikası import'lar sırasında çalışıyor, yani yukarıdaki
// `const` henüz atanmamış oluyor. Doğrudan değer verirsek `supabase` undefined
// kalır ve her çağrı 'notConfigured' döner.
jest.mock('@/lib/supabase', () => ({
  get supabase() {
    return mockSupabase;
  },
}));
jest.mock('@/services/premiumCacheGuard', () => ({ purgePremiumCacheForSignOut: jest.fn() }));
jest.mock('@/lib/socialAuth', () => ({
  // `isSocialError` gerçek olanı kalıyor: ayrımın kendisi test edilen şeyin parçası.
  ...jest.requireActual('@/lib/socialAuth'),
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...args),
  signInWithApple: (...args: unknown[]) => mockSignInWithApple(...args),
}));

import { renderHook, waitFor } from '@testing-library/react-native';

import { AuthProvider, useAuth } from '../useAuth';

async function mountAuth() {
  const { result } = await renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } });
  mockSupabase.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: jest.fn() } },
  });
  mockSupabase.auth.signInWithIdToken.mockResolvedValue({
    data: { user: { user_metadata: {} } },
    error: null,
  });
  mockSupabase.auth.updateUser.mockResolvedValue({ error: null });
});

describe('useAuth.signInWithProvider — cancellation', () => {
  it('reports a Google cancellation as cancelled, not as success', async () => {
    mockSignInWithGoogle.mockResolvedValue({ cancelled: true });
    const result = await mountAuth();

    const outcome = await result.current.signInWithProvider('google');

    expect(outcome).toEqual({ error: null, cancelled: true });
    // Vazgeçen kullanıcı için Supabase'e hiç gidilmemeli.
    expect(mockSupabase.auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('reports an Apple cancellation the same way (ERR_REQUEST_CANCELED)', async () => {
    mockSignInWithApple.mockResolvedValue({ cancelled: true });
    const result = await mountAuth();

    const outcome = await result.current.signInWithProvider('apple');

    expect(outcome).toEqual({ error: null, cancelled: true });
    expect(mockSupabase.auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('does not mark a real sign-in as cancelled', async () => {
    mockSignInWithGoogle.mockResolvedValue({ provider: 'google', idToken: 'tok' });
    const result = await mountAuth();

    const outcome = await result.current.signInWithProvider('google');

    expect(outcome.error).toBeNull();
    expect(outcome.cancelled).toBeFalsy();
    expect(mockSupabase.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'google',
      token: 'tok',
    });
  });
});

describe('useAuth.signInWithProvider — failures stay failures', () => {
  it.each([
    ['unavailable', 'auth.errors.providerUnavailable'],
    ['playServices', 'auth.errors.playServices'],
    ['noToken', 'auth.errors.generic'],
    ['error', 'auth.errors.generic'],
  ])('maps reason %s to %s without setting cancelled', async (reason, key) => {
    mockSignInWithGoogle.mockResolvedValue({ reason });
    const result = await mountAuth();

    const outcome = await result.current.signInWithProvider('google');

    expect(outcome.error).toBe(key);
    expect(outcome.cancelled).toBeFalsy();
  });

  it('surfaces a Supabase rejection of the id token as an error, not a cancellation', async () => {
    mockSignInWithGoogle.mockResolvedValue({ provider: 'google', idToken: 'tok' });
    mockSupabase.auth.signInWithIdToken.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    });
    const result = await mountAuth();

    const outcome = await result.current.signInWithProvider('google');

    expect(outcome.error).toBe('auth.errors.invalidCredentials');
    expect(outcome.cancelled).toBeFalsy();
  });
});
