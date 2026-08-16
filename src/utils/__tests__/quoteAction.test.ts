/// <reference types="jest" />
// `@react-native-async-storage/async-storage` gerçek (mock) sürümüyle çalışır —
// `reckoningAction.test.ts` ile aynı desen. `expo-notifications` yalnızca
// "bir tane daha" aksiyonunun `scheduleNotificationAsync` çağrısını gözlemlemek
// için mock'lanıyor; `scheduler.ts`teki `pickQuoteId`/`randomTitle` gerçek modülden gelir.
// Mock factory'si dışarıdaki hiçbir değişkene dokunmuyor (TDZ riski yok) — bu yüzden
// `jest.mock` çağrısı importlardan SONRA durabiliyor, babel yine de üste hoist ediyor.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoNotifications from 'expo-notifications';

import {
  ONE_MORE_DAILY_LIMIT,
  addFavorite,
  handleFavoriteAction,
  handleOneMoreAction,
  pushEngagement,
  recordEngagement,
  recordQuoteAction,
  type ExtraQuoteLog,
} from '../quoteAction';
import { QUOTE_ACTION_FAVORITE, QUOTE_ACTION_ONE_MORE, RECKONING_KIND } from '../scheduler';
import { StorageKeys } from '../storage';
import type { Quote } from '@/types/quote';

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
}));

// scheduler.test.ts ile aynı desen: dışlama testi havuzu geçici olarak
// küçük/kontrollü tutmak için bu iki fonksiyonu override eder.
jest.mock('@/data/quotes', () => {
  const actual = jest.requireActual('@/data/quotes');
  return {
    ...actual,
    getQuotesByThemes: jest.fn(actual.getQuotesByThemes),
    getQuoteById: jest.fn(actual.getQuoteById),
  };
});

const mockNotifications = ExpoNotifications as unknown as Record<string, jest.Mock>;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockNotifications.scheduleNotificationAsync.mockResolvedValue('id');
});

async function readFavorites(): Promise<number[]> {
  const raw = await AsyncStorage.getItem(StorageKeys.favorites);
  return raw ? (JSON.parse(raw) as number[]) : [];
}

async function readExtraQuoteLog(): Promise<ExtraQuoteLog | null> {
  const raw = await AsyncStorage.getItem(StorageKeys.extraQuoteLog);
  return raw ? (JSON.parse(raw) as ExtraQuoteLog) : null;
}

async function readEngagementLog(): Promise<{ hour: number; at: number }[]> {
  const raw = await AsyncStorage.getItem(StorageKeys.engagementLog);
  return raw ? (JSON.parse(raw) as { hour: number; at: number }[]) : [];
}

describe('addFavorite (saf fonksiyon)', () => {
  it('listenin başına ekler', () => {
    expect(addFavorite([2, 3], 1)).toEqual([1, 2, 3]);
  });

  it('zaten varsa DOKUNMAZ (idempotent) — aynı referansı döner', () => {
    const favorites = [1, 2, 3];
    expect(addFavorite(favorites, 2)).toBe(favorites);
  });
});

describe('pushEngagement (saf fonksiyon)', () => {
  it('yeni kaydı sona ekler', () => {
    const log = [{ hour: 9, at: 1 }];
    expect(pushEngagement(log, { hour: 10, at: 2 })).toEqual([
      { hour: 9, at: 1 },
      { hour: 10, at: 2 },
    ]);
  });

  it('cap aşılırsa EN ESKİSİNİ atar (baştan keser)', () => {
    const log = Array.from({ length: 5 }, (_, i) => ({ hour: i, at: i }));
    const next = pushEngagement(log, { hour: 99, at: 99 }, 5);
    expect(next).toHaveLength(5);
    expect(next[0]).toEqual({ hour: 1, at: 1 }); // en eski (hour:0) düştü
    expect(next[4]).toEqual({ hour: 99, at: 99 });
  });
});

describe('handleFavoriteAction', () => {
  it('quoteId favorilerin başına eklenir', async () => {
    await handleFavoriteAction(42);
    expect(await readFavorites()).toEqual([42]);
  });

  it('zaten favoriyse tekrar EKLENMEZ (idempotent)', async () => {
    await handleFavoriteAction(42);
    await handleFavoriteAction(42);
    expect(await readFavorites()).toEqual([42]);
  });

  it('quoteId undefined ise no-op', async () => {
    await handleFavoriteAction(undefined);
    expect(await readFavorites()).toEqual([]);
  });
});

describe('handleOneMoreAction', () => {
  const day1 = new Date('2026-08-19T12:00:00');
  const day2 = new Date('2026-08-20T09:00:00');

  it('0 → 1: sayaç artar ve yeni bildirim kurulur', async () => {
    await handleOneMoreAction(day1);

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(await readExtraQuoteLog()).toEqual({ date: '2026-08-19', count: 1 });
    const call = mockNotifications.scheduleNotificationAsync.mock.calls[0][0] as {
      content: { data: { quoteId: number }; categoryIdentifier: string };
    };
    expect(typeof call.content.data.quoteId).toBe('number');
    expect(call.content.categoryIdentifier).toBe('quote');
  });

  it('1 → 2: ikinci istekte de kurulur (sınıra henüz takılmadı)', async () => {
    await handleOneMoreAction(day1);
    await handleOneMoreAction(day1);

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(await readExtraQuoteLog()).toEqual({ date: '2026-08-19', count: 2 });
  });

  it(`2 → sessiz no-op: ${ONE_MORE_DAILY_LIMIT}. istekten SONRA yeni bildirim KURULMUYOR`, async () => {
    await handleOneMoreAction(day1);
    await handleOneMoreAction(day1);
    jest.clearAllMocks();

    await handleOneMoreAction(day1); // 3. deneme

    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    // sayaç sınırın ÜSTÜNE çıkmaz — sessiz no-op, log değişmez.
    expect(await readExtraQuoteLog()).toEqual({ date: '2026-08-19', count: 2 });
  });

  it('gün değişince sayaç sıfırlanır', async () => {
    await handleOneMoreAction(day1);
    await handleOneMoreAction(day1);
    jest.clearAllMocks();

    await handleOneMoreAction(day2);

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(await readExtraQuoteLog()).toEqual({ date: '2026-08-20', count: 1 });
  });

  it('kurulan bildirim scheduledQuoteIds planına eklenir (syncDeliveredToHistory onu görsün)', async () => {
    await handleOneMoreAction(day1);

    const raw = await AsyncStorage.getItem(StorageKeys.scheduledQuoteIds);
    const scheduled = JSON.parse(raw ?? '[]') as { id: number; at: number }[];
    expect(scheduled).toHaveLength(1);
    expect(typeof scheduled[0].id).toBe('number');
    expect(scheduled[0].at).toBe(day1.getTime() + 5000);
  });

  it('regresyon: AYNI bildirim kimliği, farklı çağrılar arasında (süreç değişse bile) yalnızca BİR kez işlenir', async () => {
    // İkinci code review turunun bulduğu mimari boşluk: modül-içi kilit
    // (`oneMoreQueue`) yalnızca AYNI JS süreci içindeki eşzamanlılığı kapatır.
    // Headless task tam kapalı bir uygulamada AYRI bir süreçte çalışır — kendi
    // taze kilidiyle başlar. Bu testte iki çağrı arasına `oneMoreQueue`'yu
    // sıfırlayan bir mikro-görev arası koymuyoruz bile: asıl garanti artık
    // KALICI (`processedOneMoreIds`), kilipten bağımsız. Aynı `notificationId`
    // ile art arda 3 çağrı — sonuncular no-op olmalı.
    await handleOneMoreAction(day1, undefined, 'notif-abc');
    await handleOneMoreAction(day1, undefined, 'notif-abc');
    await handleOneMoreAction(day1, undefined, 'notif-abc');

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(await readExtraQuoteLog()).toEqual({ date: '2026-08-19', count: 1 });
  });

  it('farklı bildirim kimlikleriyle gelen çağrılar birbirini ENGELLEMEZ', async () => {
    await handleOneMoreAction(day1, undefined, 'notif-a');
    await handleOneMoreAction(day1, undefined, 'notif-b');

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(await readExtraQuoteLog()).toEqual({ date: '2026-08-19', count: 2 });
  });

  it('regresyon: eşzamanlı 2 çağrı yarışmaz — sayaç sıralı olduğu gibi tam 2 olur', async () => {
    // Bulunan bug (code review, 2026-08-16): kod tabanı headless task +
    // getLastNotificationResponseAsync yedeğinin AYNI cevabı iki kez
    // işlemesini kasıtlı/zararsız sayıyordu, ama oneMore idempotent değil —
    // kilitsizken iki eşzamanlı çağrı aynı sayacı (0) okuyup İKİSİ de
    // bildirim kuruyor, sayaç 1'de kalıyordu (2 olması gerekirken).
    await Promise.all([handleOneMoreAction(day1), handleOneMoreAction(day1)]);

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(await readExtraQuoteLog()).toEqual({ date: '2026-08-19', count: 2 });
  });

  it('regresyon: eşzamanlı 3 çağrıda bile günlük sınır (2) hâlâ kesin tutar', async () => {
    await Promise.all([
      handleOneMoreAction(day1),
      handleOneMoreAction(day1),
      handleOneMoreAction(day1),
    ]);

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(ONE_MORE_DAILY_LIMIT);
    expect(await readExtraQuoteLog()).toEqual({ date: '2026-08-19', count: ONE_MORE_DAILY_LIMIT });
  });

  it('tetikleyen sözün kendisi seçim havuzundan dışlanır', async () => {
    const mockData = jest.requireMock('@/data/quotes') as {
      getQuotesByThemes: jest.Mock;
      getQuoteById: jest.Mock;
    };
    // `pickQuoteId`'nin dışlama kuralı (`pool.length > 2`) devreye girsin diye
    // 3 sözlük bir havuz — 2 sözlükte dışlama anlamsız sayılıp yok sayılıyor.
    const mkQuote = (id: number): Quote => ({
      id,
      text: `t${id}`,
      textTr: `m${id}`,
      author: 'a',
      origin: 'o',
      originEmoji: '🔥',
      category: 'fire',
      era: 'modern',
      tags: ['motivation'],
    });
    const threeQuotePool: Quote[] = [mkQuote(501), mkQuote(502), mkQuote(503)];
    mockData.getQuotesByThemes.mockReturnValue(threeQuotePool);
    mockData.getQuoteById.mockImplementation((id: number) =>
      threeQuotePool.find((q) => q.id === id)
    );

    for (let i = 0; i < 20; i++) {
      await AsyncStorage.clear();
      mockNotifications.scheduleNotificationAsync.mockClear();
      await handleOneMoreAction(day1, 501);
      const call = mockNotifications.scheduleNotificationAsync.mock.calls[0][0] as {
        content: { data: { quoteId: number } };
      };
      expect(call.content.data.quoteId).not.toBe(501);
    }

    mockData.getQuotesByThemes.mockImplementation(jest.requireActual('@/data/quotes').getQuotesByThemes);
    mockData.getQuoteById.mockImplementation(jest.requireActual('@/data/quotes').getQuoteById);
  });
});

describe('recordQuoteAction — dispatch', () => {
  it('favorite aksiyonunu favorilere yazar', async () => {
    await recordQuoteAction(QUOTE_ACTION_FAVORITE, { quoteId: 7 });
    expect(await readFavorites()).toEqual([7]);
  });

  it('oneMore aksiyonu yeni bildirim kurar', async () => {
    await recordQuoteAction(QUOTE_ACTION_ONE_MORE, { quoteId: 7 });
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('hesaplaşma bildirimi (kind: RECKONING_KIND) bu işleyiciye HİÇ düşmez', async () => {
    await recordQuoteAction(QUOTE_ACTION_FAVORITE, { kind: RECKONING_KIND, quoteId: 7 });
    await recordQuoteAction(QUOTE_ACTION_ONE_MORE, { kind: RECKONING_KIND });

    expect(await readFavorites()).toEqual([]);
    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('bilinmeyen aksiyon kimliği no-op', async () => {
    await recordQuoteAction('resisted', { quoteId: 7 });
    expect(await readFavorites()).toEqual([]);
    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('recordEngagement', () => {
  it('dokunma anını hour+at ile diske yazar', async () => {
    const now = new Date('2026-08-19T21:30:00');
    await recordEngagement(now);
    expect(await readEngagementLog()).toEqual([{ hour: 21, at: now.getTime() }]);
  });

  it('cap 200 — 201. kayıtta en eskisi düşer', async () => {
    for (let i = 0; i < 200; i++) {
      await recordEngagement(new Date(2026, 0, 1, 0, 0, i));
    }
    expect(await readEngagementLog()).toHaveLength(200);

    const extra = new Date(2026, 0, 1, 0, 3, 21); // 201. kayıt
    await recordEngagement(extra);

    const log = await readEngagementLog();
    expect(log).toHaveLength(200);
    expect(log[199].at).toBe(extra.getTime());
    // ilk kayıt (i=0) artık listede yok.
    expect(log.some((e) => e.at === new Date(2026, 0, 1, 0, 0, 0).getTime())).toBe(false);
  });
});
