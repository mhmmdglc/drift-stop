// jest.mock çağrıları babel tarafından import'ların ÜSTÜNE taşınır — import'lar
// burada en üstte durabilir ve import/first uyarısı üretmez. Factory'lerdeki
// mock* değişkenleri yalnızca ÇAĞRI anında okunur, TDZ sorunu yok.
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import SettingsScreen from '@/app/(tabs)/settings';

/**
 * Ayarlar'daki hedef satırının tek kritik sözleşmesi: commit YALNIZCA değer
 * değiştiyse `update` çağırır. `goal` SCHEDULE_KEYS'te olduğu için her gereksiz
 * çağrı 30 bildirimlik planı iptal edip yeniden kurar — ekranda görünmeyen ama
 * pilde/işlemcide gerçek bir maliyet.
 */

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

// Ekranın geri kalanındaki çizim bileşenleri bu testin konusu değil; SVG ve
// Reanimated bağımlılıkları test ortamında ayağa kalkmadığı için düzleştiriliyor.
jest.mock('@/components/WobblyBorder', () => ({ WobblyBorder: () => null }));
jest.mock('@/components/SketchUnderline', () => ({ SketchUnderline: () => null }));
jest.mock('@/components/SketchToggle', () => ({ SketchToggle: () => null }));
jest.mock('@/components/FrequencySelector', () => ({ FrequencySelector: () => null }));
jest.mock('@/components/TimePicker', () => ({ TimePicker: () => null }));
jest.mock('@/components/ThemeChips', () => ({ ThemeChips: () => null }));
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

// Anahtar-yankı çevirisi: input'u çevrilmiş metne değil anahtara göre buluyoruz.
jest.mock('@/i18n/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'tr' }),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    configured: false,
    signOut: jest.fn(),
    deleteAccount: jest.fn(),
  }),
}));

jest.mock('@/hooks/useEntitlement', () => ({
  useEntitlement: () => ({
    entitled: false,
    source: 'none',
    trialDaysLeft: 0,
    purchasesConfigured: false,
    isSubscribed: false,
    isAdsRemoved: false,
  }),
}));

jest.mock('@/lib/socialAuth', () => ({ isAppleRelayEmail: () => false }));

const mockUpdate = jest.fn();
jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({
    settings: {
      notificationsEnabled: true,
      frequency: 3,
      startHour: 9,
      startMinute: 0,
      endHour: 21,
      endMinute: 0,
      disableWeekends: false,
      themeMode: 'dark',
      language: 'tr',
      themes: [],
      goal: 'sigara',
    },
    loaded: true,
    update: mockUpdate,
    setThemeMode: jest.fn(),
    setLanguage: jest.fn(),
  }),
}));

beforeEach(() => {
  mockUpdate.mockClear();
});

const goalInput = () => screen.getByLabelText('settings.goal.label');

describe('Settings — hedef satırı commit davranışı', () => {
  it('değer değişmeden blur olursa update HİÇ çağrılmaz (plan yeniden kurulmaz)', async () => {
    await render(<SettingsScreen />);

    await fireEvent(goalInput(), 'blur');
    expect(mockUpdate).not.toHaveBeenCalled();

    // Aynı değeri yeniden yazmak da değişiklik değildir.
    await fireEvent.changeText(goalInput(), 'sigara');
    await fireEvent(goalInput(), 'blur');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('değer değişince blur\'da trim\'lenmiş hedefle update çağrılır', async () => {
    await render(<SettingsScreen />);

    await fireEvent.changeText(goalInput(), '  kitap  ');
    await fireEvent(goalInput(), 'blur');

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({ goal: 'kitap' });
  });

  it('metni boşaltıp çıkmak hedefi siler (goal: null)', async () => {
    await render(<SettingsScreen />);

    await fireEvent.changeText(goalInput(), '   ');
    await fireEvent(goalInput(), 'blur');

    expect(mockUpdate).toHaveBeenCalledWith({ goal: null });
  });

  it('klavyedeki "done" da commit eder (onSubmitEditing)', async () => {
    await render(<SettingsScreen />);

    await fireEvent.changeText(goalInput(), 'erteleme');
    await fireEvent(goalInput(), 'submitEditing');

    expect(mockUpdate).toHaveBeenCalledWith({ goal: 'erteleme' });
  });
});
