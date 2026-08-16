/// <reference types="jest" />

/**
 * Regresyon: SOS girişi Home'un interstitial sayacına DOKUNMAMALI (`w2.2-ux.md` §1,
 * `engagement-roadmap.md` W2.2 — "SOS reklam/interstitial ASLA tetiklenmez").
 * `index.tsx`'teki sayaç yalnızca `onRandom`/`onOlder` (Home içi gezinme)
 * çağırdığı `bumpAd()` üzerinden büyüyor; SOS `Pressable`'ı doğrudan
 * `router.push('/sos')` çağırıyor, sayaca hiç dokunmuyor — bu test o ayrımı sabitler.
 */

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Bu test animasyon davranışını değil basma/navigasyon çağrılarını sınıyor.
// react-native-worklets 0.8'in gerçek (ve resmi `reanimated/mock`'un da altında
// çağırdığı) native initializer'ı jest ortamında hiç yok — proje henüz
// reanimated'lı bir ekranı jest'te render etmemişti, bu yüzden kendi elle
// yazılmış, native'e hiç dokunmayan minimal bir sahte sürüm kullanılıyor.
jest.mock('react-native-reanimated', () => {
  const { View, Text } = require('react-native');
  const identity = (v: unknown) => v;
  return {
    __esModule: true,
    default: {
      View,
      Text,
      createAnimatedComponent: (Component: unknown) => Component,
    },
    useSharedValue: (initial: unknown) => ({ value: initial }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    // Callback KASTEN çağrılmıyor: bu testler animasyon TAMAMLANMA efektini değil
    // basma/navigasyon çağrılarını sınıyor; senkron çağırmak `runOnJS` zincirini
    // render döngüsü içinde tetikleyip gereksiz "overlapping act()" uyarıları üretiyordu.
    withTiming: (toValue: unknown) => toValue,
    withDelay: (_delay: number, animation: unknown) => animation,
    withSequence: (...animations: unknown[]) => animations[animations.length - 1],
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    Easing: { out: identity, cubic: identity },
  };
});

// `Gesture.Pan().onEnd(...)` de worklet derlemesi bekliyor — swipe jestini test
// dışı bırakıp yalnızca basma/navigasyon davranışını sınamak için sadeleştirildi.
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  return {
    GestureDetector: ({ children }: { children: unknown }) => children,
    Gesture: {
      Pan: () => ({ onEnd: () => ({}) }),
    },
    GestureHandlerRootView: View,
  };
});

// Kod bu çağrıların sonucunu hiç `await` etmiyor (`void Haptics...`) — gerçek bir
// Promise döndürmek, testin senkron gövdesi bittikten sonra çözülen bir microtask
// bırakıp gereksiz "overlapping act()" gürültüsü üretiyordu.
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('@/components/AdBanner', () => ({ AdBanner: () => null }));
jest.mock('@/widgets/updateWidget', () => ({ updateWidgetWithQuote: jest.fn() }));

// `constants/adUnits.ts` (`INTERSTITIAL_EVERY`'nin geldiği dosya) `react-native-google-mobile-ads`'i
// modül kapsamında import ediyor — native TurboModule kaydı test ortamında yok, sahtesi gerekiyor.
jest.mock('react-native-google-mobile-ads', () => ({
  TestIds: { BANNER: 'test-banner', INTERSTITIAL: 'test-interstitial' },
}));

const mockShowInterstitialIfReady = jest.fn(() => false);
jest.mock('@/utils/ads', () => ({
  showInterstitialIfReady: () => mockShowInterstitialIfReady(),
}));

import { QUOTES } from '@/data/quotes';

const MOCK_QUOTE = QUOTES[0];

jest.mock('@/hooks/useHistory', () => ({
  useHistory: () => ({
    quote: MOCK_QUOTE,
    goOlder: jest.fn(),
    randomFromHistory: jest.fn(),
    canOlder: true,
    count: 5,
  }),
}));

jest.mock('@/hooks/useFavorites', () => ({
  useFavorites: () => ({
    ids: [],
    isFavorite: () => false,
    toggle: jest.fn(),
    remove: jest.fn(),
    loaded: true,
  }),
}));

jest.mock('@/hooks/useReckoning', () => ({
  useReckoning: () => ({
    loaded: true,
    log: {},
    today: '2026-08-16',
    streak: 0,
    week: { resisted: 0, drifted: 0, unanswered: 7, total: 7 },
    answeredToday: null,
    hasAnyAnswer: false,
    answer: jest.fn(),
  }),
}));

jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({
    settings: { reckoningEnabled: false, disableWeekends: false },
    update: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-theme', () => {
  const { DarkColors } = require('@/constants/colors');
  return { useTheme: () => ({ colors: DarkColors, themeName: 'dark', mode: 'dark' }) };
});

// Gerçek çeviri motoru: SOS ikonunun a11y etiketini gerçek `home.sosLabel` metniyle bulacağız.
jest.mock('@/i18n/useTranslation', () => {
  const i18n = require('@/i18n').default;
  return {
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) => i18n.t(key, options),
      locale: 'en',
    }),
  };
});

import { fireEvent, render, screen } from '@testing-library/react-native';

import HomeScreen from '@/app/(tabs)/index';
import i18n from '@/i18n';
import { INTERSTITIAL_EVERY } from '@/constants/adUnits';

beforeAll(() => {
  i18n.locale = 'en';
});
afterAll(() => {
  i18n.locale = 'tr';
});

beforeEach(() => {
  mockShowInterstitialIfReady.mockClear();
  mockPush.mockClear();
});

describe('SOS navigation never feeds the interstitial counter', () => {
  // Tek render üzerinde iki fazlı tek test: önce SOS'a defalarca basılır (sayaç
  // hiç ilerlememeli), SONRA aynı ekran örneğinde Home içi gezinmeye (rastgele
  // geçmiş) basılarak sayacın GERÇEKTEN çalıştığı kanıtlanır — SOS'un onu hiç
  // beslemediği, düz mekanizmanın kendisinin bozuk olmasından değil.
  it('SOS presses never trigger the ad, later Home-internal presses do', async () => {
    await render(<HomeScreen />);
    const sosButton = await screen.findByLabelText(i18n.t('home.sosLabel'));

    // Home içi gezinmenin eşiğinin ÜSTÜNDE bir sayıda bas — sayaç SOS'tan
    // etkileniyor olsaydı bu noktada interstitial tetiklenmiş olurdu.
    for (let i = 0; i < INTERSTITIAL_EVERY + 5; i++) {
      fireEvent.press(sosButton);
    }

    expect(mockShowInterstitialIfReady).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/sos');
    expect(mockPush).toHaveBeenCalledTimes(INTERSTITIAL_EVERY + 5);

    const randomButton = screen.getByLabelText(new RegExp(i18n.t('home.randomFromHistory')));
    for (let i = 0; i < INTERSTITIAL_EVERY; i++) {
      fireEvent.press(randomButton);
    }
    expect(mockShowInterstitialIfReady).toHaveBeenCalled();
  });
});
