// jest.mock çağrıları babel tarafından import'ların ÜSTÜNE taşınır — import'lar
// burada en üstte durabilir ve import/first uyarısı üretmez.
import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import VaultEditorScreen from '@/app/vault/new';

/**
 * `/vault/new`'in tek kritik dallanması (`w2.1-ux.md` §2.3/§3.4): kapı LİSTEDE
 * değil editörün İÇİNDE. `purchasesConfigured && !entitled && activeCount >= 1`
 * ise editör YERİNE kilit paneli; aksi her durumda (config yok / Pro / henüz
 * 1. mesaj) editör görünür.
 */

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => {
  const ReactActual = require('react');
  return {
    useRouter: () => ({ push: mockPush, back: mockBack }),
    useFocusEffect: (effect: () => void | (() => void)) => {
      ReactActual.useEffect(() => effect(), []);
    },
  };
});

// `react-native-worklets`'in native initializer'ı jest ortamında yok — proje
// genelinde reanimated kullanan ekranlar için kendi elle yazılmış, native'e
// hiç dokunmayan sahte sürüm (`homeSosNoInterstitial.test.tsx`'teki AYNI blok).
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
jest.mock('@/i18n/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'tr' }),
}));

const mockUseEntitlement = jest.fn();
jest.mock('@/hooks/useEntitlement', () => ({
  useEntitlement: () => mockUseEntitlement(),
}));

const mockActiveMessageCount = jest.fn();
const mockAddMessage = jest.fn();
jest.mock('@/utils/vault', () => ({
  VAULT_FREE_ACTIVE_LIMIT: 1,
  VAULT_TEXT_MIN_LENGTH: 4,
  VAULT_TEXT_MAX_LENGTH: 280,
  activeMessageCount: () => mockActiveMessageCount(),
  addMessage: (text: string) => mockAddMessage(text),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  mockUseEntitlement.mockReset();
  mockActiveMessageCount.mockReset();
  mockAddMessage.mockReset();
});

describe('/vault/new — free-limit kapısı editörün İÇİNDE dallanır', () => {
  it('purchasesConfigured false ise kapı hiç uygulanmaz — 1 aktif mesaj olsa da editör görünür', async () => {
    mockUseEntitlement.mockReturnValue({
      entitled: false,
      entitlementKnown: true,
      purchasesConfigured: false,
    });
    mockActiveMessageCount.mockResolvedValue(1);

    await render(<VaultEditorScreen />);

    await waitFor(() =>
      expect(screen.getByPlaceholderText('vault.editorPlaceholder')).toBeTruthy()
    );
    expect(screen.queryByLabelText('packs.unlockCta')).toBeNull();
  });

  it('free kullanıcı 1 aktif mesaja ulaştıysa editör YERİNE kilit paneli gösterir', async () => {
    mockUseEntitlement.mockReturnValue({
      entitled: false,
      entitlementKnown: true,
      purchasesConfigured: true,
    });
    mockActiveMessageCount.mockResolvedValue(1);

    await render(<VaultEditorScreen />);

    await waitFor(() => expect(screen.getByLabelText('packs.unlockCta')).toBeTruthy());
    expect(screen.queryByPlaceholderText('vault.editorPlaceholder')).toBeNull();
  });

  it('free kullanıcı henüz 0 aktif mesajdaysa editör görünür (kilit YOK)', async () => {
    mockUseEntitlement.mockReturnValue({
      entitled: false,
      entitlementKnown: true,
      purchasesConfigured: true,
    });
    mockActiveMessageCount.mockResolvedValue(0);

    await render(<VaultEditorScreen />);

    await waitFor(() =>
      expect(screen.getByPlaceholderText('vault.editorPlaceholder')).toBeTruthy()
    );
    expect(screen.queryByLabelText('packs.unlockCta')).toBeNull();
  });

  it('Pro kullanıcı (entitled) aktif sayı ne olursa olsun kilitlenmez', async () => {
    mockUseEntitlement.mockReturnValue({
      entitled: true,
      entitlementKnown: true,
      purchasesConfigured: true,
    });
    mockActiveMessageCount.mockResolvedValue(5);

    await render(<VaultEditorScreen />);

    await waitFor(() =>
      expect(screen.getByPlaceholderText('vault.editorPlaceholder')).toBeTruthy()
    );
    expect(screen.queryByLabelText('packs.unlockCta')).toBeNull();
  });

  it('entitlement henüz bilinmiyorsa (entitlementKnown false) kilit yerine yükleniyor gösterir', async () => {
    mockUseEntitlement.mockReturnValue({
      entitled: false,
      entitlementKnown: false,
      purchasesConfigured: true,
    });
    mockActiveMessageCount.mockResolvedValue(1);

    await render(<VaultEditorScreen />);

    expect(screen.getByText('common.loading')).toBeTruthy();
    expect(screen.queryByLabelText('packs.unlockCta')).toBeNull();
    expect(screen.queryByPlaceholderText('vault.editorPlaceholder')).toBeNull();
  });
});
