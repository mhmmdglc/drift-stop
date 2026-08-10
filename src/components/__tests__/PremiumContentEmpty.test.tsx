import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { PremiumContentEmpty } from '@/components/PremiumContentEmpty';

/**
 * Bu testin koruduğu hata canlıya çıkmıştı: hak sahibi MİSAFİR kullanıcıya
 * "sözler birazdan burada olacak" deniyordu, ama premium satırlar RLS gereği
 * yalnızca oturum açmış kullanıcıya döndüğü için o "birazdan" hiç gelmiyordu.
 * Paywall "3.325+ premium söz" satarken içeri girenin sonsuza kadar bekleme
 * yazısıyla kalması, ödeme yapan kullanıcı için ürünün eksik kalması demek.
 *
 * Bu yüzden test METNİN VARLIĞINI değil, KOŞULA GÖRE DEĞİŞTİĞİNİ sınıyor:
 * aynı bileşen, yalnızca oturum durumu değiştiği için farklı şey göstermeli.
 */

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

// SketchButton Reanimated'e bağlı ve Reanimated bu test ortamında ayağa kalkmıyor.
// Burada sınanan şey düğmenin çizimi değil, HANGİ DALIN seçildiği ve düğmenin
// NEREYE gittiği — o yüzden etiketi ve onPress'i geçiren düz bir yerine koyuyoruz.
jest.mock('@/components/SketchButton', () => {
  const { Text } = require('react-native');
  return {
    SketchButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Text onPress={onPress}>{label}</Text>
    ),
  };
});

let mockEntitled = false;
let mockUser: { id: string } | null = null;
let mockAuthConfigured = true;

jest.mock('@/hooks/useEntitlement', () => ({ useEntitlement: () => ({ entitled: mockEntitled }) }));
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser, configured: mockAuthConfigured }),
}));

// Çeviri anahtarını olduğu gibi döndür: hangi dalın seçildiğini anahtar üzerinden
// görmek, çevrilmiş metne bağlı kalmaktan daha sağlam.
jest.mock('@/i18n/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'en' }),
}));

// ThemedText gerçek ThemeProvider ister; buradaki mesele renk değil, metin.
jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({ colors: { textMuted: '#888', text: '#fff', accent: '#c90' } }),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockEntitled = false;
  mockUser = null;
  mockAuthConfigured = true;
});

describe('PremiumContentEmpty', () => {
  it('tells an entitled guest to sign in instead of promising content that cannot arrive', async () => {
    mockEntitled = true;
    mockUser = null;

    await render(<PremiumContentEmpty />);

    expect(screen.getByText('packs.needsAccountTitle')).toBeTruthy();
    expect(screen.queryByText('packs.syncingBody')).toBeNull();

    // Çağrı bir yere GİTMELİ; yoksa kullanıcıya sorunu söyleyip çözümü vermemiş oluruz.
    fireEvent.press(screen.getByText('packs.needsAccountCta'));
    expect(mockPush).toHaveBeenCalledWith('/auth');
  });

  it('keeps the waiting message for an entitled user who IS signed in — that download is real', async () => {
    mockEntitled = true;
    mockUser = { id: 'u1' };

    await render(<PremiumContentEmpty />);

    expect(screen.getByText('packs.syncingBody')).toBeTruthy();
    expect(screen.queryByText('packs.needsAccountTitle')).toBeNull();
  });

  it('does not push an account on a user with no entitlement', async () => {
    mockEntitled = false;
    mockUser = null;

    await render(<PremiumContentEmpty />);

    expect(screen.getByText('packs.syncingBody')).toBeTruthy();
  });

  it('stays quiet about accounts when auth is not configured at all', async () => {
    // Supabase anahtarı yoksa hesap diye bir şey yok; giriş çağrısı göstermek
    // kullanıcıyı var olmayan bir ekrana yollamak olurdu.
    mockEntitled = true;
    mockUser = null;
    mockAuthConfigured = false;

    await render(<PremiumContentEmpty />);

    expect(screen.getByText('packs.syncingBody')).toBeTruthy();
    expect(screen.queryByText('packs.needsAccountTitle')).toBeNull();
  });
});
