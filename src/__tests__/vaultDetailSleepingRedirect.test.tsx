// jest.mock çağrıları babel tarafından import'ların ÜSTÜNE taşınır — import'lar
// burada en üstte durabilir ve import/first uyarısı üretmez.
import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import VaultDetailScreen from '@/app/vault/[id]';

/**
 * `/vault/[id]`'in güvenlik ağı: uyuyan (`deliveredAt === null`) bir mesaja bu
 * route'a ULAŞILMAMASI gerekir (liste zaten yalnızca teslim edilmiş satırları
 * tıklanabilir yapıyor) — ama eski bir bildirim/derin bağlantı yine de
 * düşürebilir. Bu durumda içerik BİR AN BİLE render edilmeden `/vault`e
 * yönlendirilir (`engagement-roadmap.md` W2.1: "uyuyan mesajın içeriği asla
 * gösterilmez" kuralı bu route için de geçerli).
 */

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: mockReplace, canGoBack: () => true }),
  useLocalSearchParams: () => ({ id: '1' }),
}));

const mockListMessages = jest.fn();
jest.mock('@/utils/vault', () => ({
  listMessages: () => mockListMessages(),
  deleteMessage: jest.fn(),
  rearmMessage: jest.fn(),
}));

// `react-native-worklets`'in native initializer'ı jest ortamında yok — ekran
// `SketchButton` (rearm/"Kasaya dön") üzerinden reanimated'a dokunuyor;
// `homeSosNoInterstitial.test.tsx`'teki AYNI elle-yazılmış sahte sürüm.
jest.mock('react-native-reanimated', () => {
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: {
      View,
      Text,
      createAnimatedComponent: (Component: unknown) => Component,
    },
    useSharedValue: (initial: unknown) => ({ value: initial }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (toValue: unknown) => toValue,
  };
});
jest.mock('@/components/WobblyBorder', () => ({ WobblyBorder: () => null }));

jest.mock('@/components/PaperBackground', () => ({
  PaperBackground: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    colors: { text: '#fff', textMuted: '#888', accent: '#c90', faintLine: '#444', fire: '#c33' },
  }),
}));
// Anahtar-yankı çevirisi: interpolasyon parametreleri bu testin konusu değil.
jest.mock('@/i18n/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'tr' }),
}));

beforeEach(() => {
  mockReplace.mockClear();
  mockBack.mockClear();
});

describe('/vault/[id] — uyuyan mesaj güvenlik ağı', () => {
  it('deliveredAt null olan bir mesaja ulaşınca içerik RENDER ETMEDEN /vault\'e yönlendirir', async () => {
    mockListMessages.mockResolvedValue([
      { id: 1, text: 'gizli metin', createdAt: 0, deliveredAt: null, rearmedAt: null },
    ]);

    await render(<VaultDetailScreen />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/vault'));
    // İçerik hiçbir anda render edilmedi — sürpriz kuralı ihlal edilmedi.
    expect(screen.queryByText('gizli metin')).toBeNull();
  });

  it('bulunamayan bir id\'de notFound gösterir, İÇERİK üretmeye çalışmaz', async () => {
    mockListMessages.mockResolvedValue([]);

    await render(<VaultDetailScreen />);

    await waitFor(() => expect(screen.getByText('vault.notFound')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('teslim edilmiş bir mesajın metnini gösterir (yönlendirme YOK)', async () => {
    mockListMessages.mockResolvedValue([
      { id: 1, text: 'artık okunabilir', createdAt: 0, deliveredAt: 12345, rearmedAt: null },
    ]);

    await render(<VaultDetailScreen />);

    await waitFor(() => expect(screen.getByText('artık okunabilir')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
