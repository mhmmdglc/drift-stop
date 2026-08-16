/// <reference types="jest" />
// Tip-import derlemede silinir → jest.mock hoisting'inden etkilenmez, en üstte durabilir.
import type { Quote } from '@/types/quote';
// i18n mock'lanmıyor ve jest.mock çağrıları babel'ce bunun üstüne taşınır —
// gerçek çeviri dosyalarıyla çalışır (interpolasyon davranışı gerçek motorda sınanır).
import i18n from '@/i18n';
/**
 * `scheduler.ts` — uygulamanın çekirdeği ve bugüne kadar SIFIR testi vardı.
 * Buradaki bir regresyon sessizdir: bildirimler yalnızca gelmemeye başlar, hiçbir
 * ekran hata vermez. Testler o yüzden davranışın gözlemlenebilir sonucuna bakıyor
 * (kaç bildirim kuruldu, hangileri iptal edildi, diske ne yazıldı).
 */
// Mock factory'nin İÇİNDE kuruluyor: `jest.mock` çağrıları import'ların üstüne
// hoist edilir, yani dışarıda tanımlanmış bir `const`a dokunmak TDZ hatası verir
// (modül require edildiğinde o const henüz başlatılmamış olur).
jest.mock('expo-notifications', () => ({
  setNotificationChannelAsync: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  getPresentedNotificationsAsync: jest.fn(),
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));
jest.mock('@/utils/runtime', () => ({ nativeFeaturesAvailable: true, isExpoGo: false }));

// Varsayılan gerçek veri; tekrar-önleme testleri küçük/uç havuzları ancak
// bu iki fonksiyonu geçici override ederek kurabiliyor (1000 sözlük gerçek
// havuzda "hepsi dışlandı" durumu üretilemez).
jest.mock('@/data/quotes', () => {
  const actual = jest.requireActual('@/data/quotes');
  return {
    ...actual,
    getQuotesByThemes: jest.fn(actual.getQuotesByThemes),
    getQuoteById: jest.fn(actual.getQuoteById),
  };
});

const store: Record<string, unknown> = {};
jest.mock('@/utils/storage', () => ({
  StorageKeys: {
    scheduledQuoteIds: 'k:scheduled',
    lastScheduledDate: 'k:lastDate',
    seenHistory: 'k:history',
  },
  getJSON: jest.fn(async (key: string, fallback: unknown) =>
    key in store ? store[key] : fallback
  ),
  setJSON: jest.fn(async (key: string, value: unknown) => {
    store[key] = value;
  }),
}));

import * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  applySchedule,
  cancelAll,
  ensurePermissions,
  randomTitle,
  rescheduleIfNeeded,
  setupAndroidChannel,
  setupNotificationCategories,
  syncDeliveredToHistory,
  NOTIFICATION_CHANNEL_ID,
  TRIAL_CHANNEL_ID,
  TRIAL_NOTICE_KIND,
  RECKONING_KIND,
  RECKONING_CATEGORY,
  RECKONING_ACTION_RESISTED,
  RECKONING_ACTION_DRIFTED,
} from '../scheduler';
import { DEFAULT_SETTINGS, type Settings } from '@/types/settings';
import { dateKey } from '@/utils/timeUtils';

const mockNotifications = ExpoNotifications as unknown as Record<string, jest.Mock>;

const settings = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over });

/**
 * `Settings.reckoningEnabled` varsayılan `true` (W1.3) — `applySchedule` artık her
 * plan gününe bir hesaplaşma bildirimi de ekliyor. Aşağıdaki söz-odaklı testler bunu
 * bilmiyor olmalı (kendi describe bloğu var), o yüzden ölçümler yalnızca `quoteId`
 * taşıyan çağrıları sayar — hesaplaşma çağrıları `content.data.quoteId` taşımaz.
 */
const isQuoteCall = (call: unknown[]) =>
  typeof (call[0] as { content: { data?: { quoteId?: number } } }).content.data?.quoteId ===
  'number';

/** Kurulan SÖZ bildirimlerinin `trigger.date`i (planlama döngüsünü doğrulamak için). */
const scheduledDates = (): Date[] =>
  mockNotifications.scheduleNotificationAsync.mock.calls
    .filter(isQuoteCall)
    .map((c) => (c[0] as { trigger: { date: Date } }).trigger.date);

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(store)) delete store[k];
  mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  mockNotifications.getPresentedNotificationsAsync.mockResolvedValue([]);
  mockNotifications.scheduleNotificationAsync.mockResolvedValue('id');
  mockNotifications.cancelAllScheduledNotificationsAsync.mockResolvedValue(undefined);
  mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
  mockNotifications.setNotificationChannelAsync.mockResolvedValue(undefined);
  mockNotifications.setNotificationCategoryAsync.mockResolvedValue(undefined);
});

describe('ensurePermissions', () => {
  it('izin zaten varsa tekrar SORMAZ', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });

    await expect(ensurePermissions()).resolves.toBe(true);
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('izin yoksa ve sorulabiliyorsa sorar', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    mockNotifications.requestPermissionsAsync.mockResolvedValue({ granted: true });

    await expect(ensurePermissions()).resolves.toBe(true);
    expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('kullanıcı kalıcı olarak reddettiyse SORMAZ (sistem zaten göstermez)', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });

    await expect(ensurePermissions()).resolves.toBe(false);
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('setupAndroidChannel', () => {
  it('Android’de İKİ kanal kurar — günlük ve deneme', async () => {
    (Platform as unknown as { OS: string }).OS = 'android';

    await setupAndroidChannel();

    const ids = mockNotifications.setNotificationChannelAsync.mock.calls.map((c) => c[0]);
    expect(ids).toEqual(expect.arrayContaining([NOTIFICATION_CHANNEL_ID, TRIAL_CHANNEL_ID]));
  });

  it('iOS’ta kanal kurmaz (kanal kavramı yok)', async () => {
    (Platform as unknown as { OS: string }).OS = 'ios';

    await setupAndroidChannel();

    expect(mockNotifications.setNotificationChannelAsync).not.toHaveBeenCalled();
    (Platform as unknown as { OS: string }).OS = 'android';
  });
});

describe('cancelAll', () => {
  it('deneme uyarılarını KORUR, yalnızca günlükleri iptal eder', async () => {
    // EN KRİTİK TEST. Bu fonksiyon `cancelAllScheduledNotificationsAsync` kullanıyordu:
    // her yeni günde `rescheduleIfNeeded` → `applySchedule` → buraya geliyor ve 6./7. gün
    // deneme uyarılarını da siliyordu. Uyarılar deneme başında bir kez kurulduğu için
    // bir daha geri gelmiyor, kullanıcı denemenin bittiğini habersiz yaşıyordu.
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'daily-1', content: { data: { quoteId: 1 } } },
      { identifier: 'trial-6', content: { data: { kind: TRIAL_NOTICE_KIND } } },
      { identifier: 'daily-2', content: { data: { quoteId: 2 } } },
    ]);

    await cancelAll();

    expect(mockNotifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    const cancelled = mockNotifications.cancelScheduledNotificationAsync.mock.calls.map((c) => c[0]);
    expect(cancelled.sort()).toEqual(['daily-1', 'daily-2']);
  });

  it('deneme uyarısı yoksa tek toplu çağrı yapar (ucuz yol)', async () => {
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'daily-1', content: { data: { quoteId: 1 } } },
    ]);

    await cancelAll();

    expect(mockNotifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mockNotifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('işaretsiz eski bildirimleri günlük sayar (geriye dönük uyumluluk)', async () => {
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'legacy', content: {} },
      { identifier: 'trial', content: { data: { kind: TRIAL_NOTICE_KIND } } },
    ]);

    await cancelAll();

    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('legacy');
  });

  it('liste okunamazsa yine de temizler — bildirimler katlanarak birikmemeli', async () => {
    mockNotifications.getAllScheduledNotificationsAsync.mockRejectedValue(new Error('boom'));

    await cancelAll();

    expect(mockNotifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
  });
});

describe('applySchedule', () => {
  it('bildirimler kapalıysa planı temizler ve HİÇ bildirim kurmaz', async () => {
    await applySchedule(settings({ notificationsEnabled: false }));

    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(store['k:scheduled']).toEqual([]);
    // Tarih damgası da sıfırlanmalı, yoksa bildirimler geri açıldığında
    // `rescheduleIfNeeded` "bugün zaten planlandı" deyip hiç plan kurmaz.
    expect(store['k:lastDate']).toBe('');
  });

  it('geçersiz zaman aralığında hiçbir şey kurmaz', async () => {
    // Bitiş başlangıçtan önce → `isValidWindow` false.
    await applySchedule(settings({ startHour: 21, startMinute: 0, endHour: 9, endMinute: 0 }));

    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('frekans başına 3 günlük plan kurar ve hepsini diske yazar', async () => {
    await applySchedule(settings({ frequency: 3 }));

    const count = mockNotifications.scheduleNotificationAsync.mock.calls.filter(isQuoteCall).length;
    // Bugünün penceresi kısmen geçmiş olabilir → üst sınır 3 gün × 3, alt sınır 2 gün × 3.
    expect(count).toBeGreaterThanOrEqual(6);
    expect(count).toBeLessThanOrEqual(9);
    expect((store['k:scheduled'] as unknown[]).length).toBe(count);
    expect(store['k:lastDate']).toBe(dateKey(new Date()));
  });

  it('daha yüksek frekans daha çok bildirim kurar', async () => {
    await applySchedule(settings({ frequency: 3 }));
    const low = mockNotifications.scheduleNotificationAsync.mock.calls.filter(isQuoteCall).length;

    jest.clearAllMocks();
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('id');
    await applySchedule(settings({ frequency: 10 }));
    const high = mockNotifications.scheduleNotificationAsync.mock.calls.filter(isQuoteCall).length;

    expect(high).toBeGreaterThan(low);
  });

  it('asla geçmişe bildirim kurmaz', async () => {
    await applySchedule(settings({ frequency: 10 }));

    const now = Date.now();
    for (const d of scheduledDates()) expect(d.getTime()).toBeGreaterThan(now);
  });

  it('her bildirim günlük kanala ve quoteId verisiyle gider', async () => {
    await applySchedule(settings({ frequency: 3 }));

    for (const call of mockNotifications.scheduleNotificationAsync.mock.calls.filter(isQuoteCall)) {
      const arg = call[0] as {
        content: { body: string; data: { quoteId: number } };
        trigger: { channelId: string };
      };
      expect(arg.trigger.channelId).toBe(NOTIFICATION_CHANNEL_ID);
      expect(typeof arg.content.data.quoteId).toBe('number');
      // Boş gövdeli bildirim kullanıcıya boş kart gösterir.
      expect(arg.content.body.length).toBeGreaterThan(0);
    }
  });

  it('hafta sonu kapalıyken cumartesi/pazara bildirim kurmaz', async () => {
    await applySchedule(settings({ frequency: 10, disableWeekends: true }));

    for (const d of scheduledDates()) {
      expect([0, 6]).not.toContain(d.getDay());
    }
  });

  it('yeniden planlamadan önce eskiyi iptal eder', async () => {
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'old', content: { data: { quoteId: 9 } } },
    ]);

    await applySchedule(settings());

    expect(mockNotifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
  });
});

describe('applySchedule — rotasyonda tekrar önleme', () => {
  const mockData = jest.requireMock('@/data/quotes') as {
    getQuotesByThemes: jest.Mock;
    getQuoteById: jest.Mock;
  };

  const mkQuotes = (n: number): Quote[] =>
    Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      text: `t${i + 1}`,
      textTr: `m${i + 1}`,
      author: 'a',
      origin: 'o',
      originEmoji: '🔥',
      category: 'fire',
      era: 'modern',
      tags: ['motivation'],
    }));

  const usePool = (pool: Quote[]) => {
    mockData.getQuotesByThemes.mockReturnValue(pool);
    mockData.getQuoteById.mockImplementation((id: number) => pool.find((q) => q.id === id));
  };

  const scheduledQuoteIds = (): number[] =>
    mockNotifications.scheduleNotificationAsync.mock.calls
      .filter(isQuoteCall)
      .map((c) => (c[0] as { content: { data: { quoteId: number } } }).content.data.quoteId);

  afterEach(() => {
    // Override'lar `clearAllMocks`tan sağ çıkar (mockClear implementasyonu silmez)
    // → gerçek veri diğer describe'lara elle geri verilmeli.
    const actual = jest.requireActual('@/data/quotes') as {
      getQuotesByThemes: (...args: unknown[]) => unknown;
      getQuoteById: (...args: unknown[]) => unknown;
    };
    mockData.getQuotesByThemes.mockImplementation(actual.getQuotesByThemes);
    mockData.getQuoteById.mockImplementation(actual.getQuoteById);
  });

  it('yakın geçmişteki sözler plana girmez', async () => {
    const pool = mkQuotes(40);
    usePool(pool);
    // 10 kayıt < floor(40 × 0.5) = 20 → geçmişin tamamı dışlama setinde.
    const recent = pool.slice(0, 10).map((q) => q.id);
    store['k:history'] = recent;

    await applySchedule(settings({ frequency: 3 }));

    const ids = scheduledQuoteIds();
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(recent).not.toContain(id);
  });

  it('havuzun tamamı geçmişteyse yine plan kurulur (dışlama havuzun yarısıyla sınırlı)', async () => {
    const pool = mkQuotes(6);
    usePool(pool);
    store['k:history'] = pool.map((q) => q.id);

    await applySchedule(settings({ frequency: 3 }));

    const ids = scheduledQuoteIds();
    // Plan içi seçimler dışlama setini havuzun ötesine büyütür → "hepsi dışlandı"
    // dalı da bu testte çalışır; planlama yine de durmamalı.
    expect(ids.length).toBeGreaterThanOrEqual(6);
    for (const id of ids) expect(pool.map((q) => q.id)).toContain(id);
  });

  it('3 günlük plan kendi içinde tekrarsız (havuz yeterince genişken)', async () => {
    usePool(mkQuotes(200));

    await applySchedule(settings({ frequency: 10 }));

    const ids = scheduledQuoteIds();
    // 30 bildirim ≤ havuzun yarısı (100) → tek bir tekrar bile regresyondur.
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tek sözlük havuz çökmez, planlamaya devam eder', async () => {
    usePool(mkQuotes(1));
    store['k:history'] = [1];

    await applySchedule(settings({ frequency: 3 }));

    const ids = scheduledQuoteIds();
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(id).toBe(1);
  });
});

describe('randomTitle — hedef kişiselleştirmesi', () => {
  // W0.c tuzağı: %{goal} parametresiz çözülürse çıktı "[missing …]" olur ve
  // bildirim başlığında aynen görünür. Bu describe o tuzağın regresyon bekçisi.
  let randomSpy: jest.SpyInstance | null = null;

  afterEach(() => {
    randomSpy?.mockRestore();
    randomSpy = null;
  });

  it('hedef null iken hiçbir Math.random dalında goalTitles havuzuna girmez', () => {
    const titles = i18n.t('notifications.titles') as unknown as string[];
    // Oran zarının her iki tarafı ve uç değerler: dal ne olursa olsun jenerik havuz.
    for (const r of [0, 0.1, 0.29, 0.3, 0.7, 0.999]) {
      randomSpy = jest.spyOn(Math, 'random').mockReturnValue(r);
      const title = randomTitle(null);
      expect({ r, title }).toEqual({ r, title: expect.not.stringContaining('missing') });
      expect(titles).toContain(title);
      randomSpy.mockRestore();
      randomSpy = null;
    }
  });

  it('hedef varken oran zarı %30 altındaysa şablonu hedefle interpolate eder', () => {
    // 1. çağrı oran zarı (<0.3 → kişisel havuz), 2. çağrı şablon seçimi.
    randomSpy = jest.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0);
    const title = randomTitle('sigara');
    expect(title).toContain('sigara');
    expect(title).not.toContain('missing');
  });

  it('hedef varken oran zarı %30 üstündeyse jenerik havuzdan seçer', () => {
    const titles = i18n.t('notifications.titles') as unknown as string[];
    randomSpy = jest.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0.5);
    const title = randomTitle('sigara');
    expect(titles).toContain(title);
  });

  it('her goalTitles şablonu eksik parametre bırakmadan çözülür', () => {
    const goalTitles = i18n.t('notifications.goalTitles') as unknown as string[];
    expect(goalTitles.length).toBeGreaterThan(0);
    goalTitles.forEach((_, idx) => {
      randomSpy = jest
        .spyOn(Math, 'random')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(idx / goalTitles.length);
      const title = randomTitle('erteleme');
      expect({ idx, title }).toEqual({ idx, title: expect.stringContaining('erteleme') });
      expect(title).not.toContain('missing');
      randomSpy?.mockRestore();
      randomSpy = null;
    });
  });

  it('applySchedule hedefi başlıklara geçirir ve hiçbir başlıkta "[missing" kalmaz', async () => {
    const titlesOf = (): string[] =>
      mockNotifications.scheduleNotificationAsync.mock.calls.map(
        (c) => (c[0] as { content: { title: string } }).content.title
      );

    await applySchedule(settings({ frequency: 10, goal: 'sigara' }));
    const withGoal = titlesOf();
    expect(withGoal.length).toBeGreaterThan(0);
    for (const title of withGoal) expect(title).not.toContain('missing');

    jest.clearAllMocks();
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('id');

    await applySchedule(settings({ frequency: 10, goal: null }));
    const goalTitles = i18n.t('notifications.goalTitles') as unknown as string[];
    for (const title of titlesOf()) {
      expect(title).not.toContain('missing');
      // Hedefsiz kullanıcıya şablon iskeleti bile sızmamalı.
      expect(goalTitles).not.toContain(title);
    }
  });
});

describe('rescheduleIfNeeded', () => {
  it('bugün için plan yoksa planlar', async () => {
    store['k:lastDate'] = '2020-01-01';

    await rescheduleIfNeeded(settings());

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it('bugün zaten planlandıysa dokunmaz', async () => {
    store['k:lastDate'] = dateKey(new Date());
    store['k:scheduled'] = [{ id: 1, at: Date.now() + 100000 }];

    await rescheduleIfNeeded(settings());

    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('eski format (number[]) tespit edilirse yeniden planlar', async () => {
    // Eski sürüm sadece id saklıyordu; fire zamanı olmadan `syncDeliveredToHistory`
    // hangi bildirimin teslim edildiğini bilemez ve geçmiş sessizce boş kalır.
    store['k:lastDate'] = dateKey(new Date());
    store['k:scheduled'] = [1, 2, 3];

    await rescheduleIfNeeded(settings());

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it('bildirimler kapalıysa sadece iptal eder', async () => {
    await rescheduleIfNeeded(settings({ notificationsEnabled: false }));

    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mockNotifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
  });
});

describe('syncDeliveredToHistory', () => {
  it('teslim edilecek bir şey yoksa null döner', async () => {
    await expect(syncDeliveredToHistory()).resolves.toBeNull();
  });

  it('çekmecede duran bildirimin sözünü geçmişe taşır', async () => {
    mockNotifications.getPresentedNotificationsAsync.mockResolvedValue([
      { request: { content: { data: { quoteId: 42 } } } },
    ]);

    await expect(syncDeliveredToHistory()).resolves.toEqual([42]);
    expect(store['k:history']).toEqual([42]);
  });

  it('fire zamanı geçmiş planlıları geçmişe taşır ve plandan düşürür', async () => {
    const past = Date.now() - 60_000;
    const future = Date.now() + 60_000;
    store['k:scheduled'] = [
      { id: 7, at: past },
      { id: 8, at: future },
    ];

    const history = await syncDeliveredToHistory();

    expect(history).toEqual([7]);
    // Gelecekteki plan korunmalı; silinirse o bildirim geldiğinde geçmişe hiç yazılmaz.
    expect(store['k:scheduled']).toEqual([{ id: 8, at: future }]);
  });

  it('en yeni söz başa gelir ve tekrar eklenen id çoğaltılmaz', async () => {
    store['k:history'] = [5, 3];
    const past = Date.now() - 1000;
    store['k:scheduled'] = [{ id: 3, at: past }];

    await expect(syncDeliveredToHistory()).resolves.toEqual([3, 5]);
  });

  it('çekmece okunamazsa planlı olanları yine de işler', async () => {
    mockNotifications.getPresentedNotificationsAsync.mockRejectedValue(new Error('nope'));
    store['k:scheduled'] = [{ id: 11, at: Date.now() - 1000 }];

    await expect(syncDeliveredToHistory()).resolves.toEqual([11]);
  });

  it('geçmişi 200 kayıtla sınırlar', async () => {
    store['k:history'] = Array.from({ length: 200 }, (_, i) => i + 1000);
    store['k:scheduled'] = [{ id: 1, at: Date.now() - 1000 }];

    const history = await syncDeliveredToHistory();

    expect(history).toHaveLength(200);
    expect(history?.[0]).toBe(1);
  });
});

describe('setupNotificationCategories', () => {
  it('reckoning kategorisini iki aksiyonla kaydeder — ikisi de opensAppToForeground:false', async () => {
    await setupNotificationCategories();

    expect(mockNotifications.setNotificationCategoryAsync).toHaveBeenCalledWith(
      RECKONING_CATEGORY,
      [
        {
          identifier: RECKONING_ACTION_RESISTED,
          buttonTitle: i18n.t('reckoning.actionResisted'),
          options: { opensAppToForeground: false },
        },
        {
          identifier: RECKONING_ACTION_DRIFTED,
          buttonTitle: i18n.t('reckoning.actionDrifted'),
          options: { opensAppToForeground: false },
        },
      ]
    );
  });

  it('API reddederse sessizce geçer (eski cihaz/OS)', async () => {
    mockNotifications.setNotificationCategoryAsync.mockRejectedValueOnce(new Error('nope'));

    await expect(setupNotificationCategories()).resolves.toBeUndefined();
  });
});

describe('applySchedule — gece hesaplaşması', () => {
  const reckoningCalls = () =>
    mockNotifications.scheduleNotificationAsync.mock.calls.filter(
      (c) =>
        (c[0] as { content: { data?: { kind?: string } } }).content.data?.kind === RECKONING_KIND
    );

  const quoteCalls = () =>
    mockNotifications.scheduleNotificationAsync.mock.calls.filter(
      (c) => typeof (c[0] as { content: { data?: { quoteId?: number } } }).content.data?.quoteId === 'number'
    );

  it('dil değişse de yeniden pişsin diye kategoriyi HER çağrıda yeniden kaydeder', async () => {
    await applySchedule(settings());
    expect(mockNotifications.setNotificationCategoryAsync).toHaveBeenCalled();
  });

  it('her plan gününe (hafta sonu hariç) bir hesaplaşma bildirimi ekler', async () => {
    await applySchedule(settings());

    // DAYS_AHEAD=3; bugünün penceresi kısmen geçmiş olabileceğinden alt sınır 2.
    expect(reckoningCalls().length).toBeGreaterThanOrEqual(2);
    expect(reckoningCalls().length).toBeLessThanOrEqual(3);
  });

  it('saat = pencere bitişi + 45 dk (23:15 altında kaldığı sürece)', async () => {
    await applySchedule(settings({ startHour: 7, startMinute: 0, endHour: 9, endMinute: 0 }));

    const calls = reckoningCalls();
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      const date = (c[0] as { trigger: { date: Date } }).trigger.date;
      expect(date.getHours() * 60 + date.getMinutes()).toBe(9 * 60 + 45);
    }
  });

  it('gün taşarsa 23:59 tavanına kırpılır (23:45 değil 00:xx üretmez)', async () => {
    await applySchedule(settings({ startHour: 20, startMinute: 0, endHour: 23, endMinute: 30 }));

    const calls = reckoningCalls();
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      const date = (c[0] as { trigger: { date: Date } }).trigger.date;
      expect(date.getHours()).toBe(23);
      expect(date.getMinutes()).toBe(59);
    }
  });

  it('regresyon: kırpma penceresinin bitişinden ASLA erken kurulmaz', async () => {
    // Bulunan bug: sabit 23:15 tavanı, endMin zaten 23:15'i geçmişse hesaplaşmayı
    // pencere kapanmadan ÖNCE kuruyordu. 23:00-23:45 penceresinde +45dk = 00:30 (ertesi
    // gün) taşar; doğru davranış 23:59'a kırpmak ve bunun endMin'den (23:45) ERKEN
    // olmamasıdır — 23:15'e kırpmak burada endMin'den 30 dk ERKEN bir zaman üretirdi.
    await applySchedule(settings({ startHour: 21, startMinute: 0, endHour: 23, endMinute: 45 }));

    const reckoning = reckoningCalls();
    const quotes = quoteCalls();
    expect(reckoning.length).toBeGreaterThan(0);
    for (const c of reckoning) {
      const date = (c[0] as { trigger: { date: Date } }).trigger.date;
      const minuteOfDay = date.getHours() * 60 + date.getMinutes();
      expect(minuteOfDay).toBeGreaterThanOrEqual(23 * 60 + 45); // >= endMin
    }
    // Aynı günün söz bildirimleri de pencere içinde kalmalı — hesaplaşmadan SONRA
    // gelen bir söz olmamalı (kronolojik ters dönme regresyonu).
    for (const c of quotes) {
      const date = (c[0] as { trigger: { date: Date } }).trigger.date;
      const minuteOfDay = date.getHours() * 60 + date.getMinutes();
      expect(minuteOfDay).toBeLessThanOrEqual(23 * 60 + 45);
    }
  });

  it('disableWeekends açıkken hafta sonuna hesaplaşma da kurulmaz', async () => {
    await applySchedule(settings({ frequency: 10, disableWeekends: true }));

    for (const c of reckoningCalls()) {
      const date = (c[0] as { trigger: { date: Date } }).trigger.date;
      expect([0, 6]).not.toContain(date.getDay());
    }
  });

  it('reckoningEnabled false iken hiç kurulmaz — sözler etkilenmez', async () => {
    await applySchedule(settings({ reckoningEnabled: false }));

    expect(reckoningCalls()).toHaveLength(0);
    expect(quoteCalls().length).toBeGreaterThan(0);
  });

  it('notificationsEnabled false iken hesaplaşma da kurulmaz', async () => {
    await applySchedule(settings({ notificationsEnabled: false }));

    expect(reckoningCalls()).toHaveLength(0);
  });

  it('kanal/kategori/veri doğru, ve `scheduledQuoteIds` planına SIZMAZ (söz değildir)', async () => {
    await applySchedule(settings());

    const calls = reckoningCalls();
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      const arg = c[0] as {
        content: { title: string; body: string; categoryIdentifier: string; data: { kind: string; date: string } };
        trigger: { channelId: string };
      };
      expect(arg.trigger.channelId).toBe(NOTIFICATION_CHANNEL_ID);
      expect(arg.content.categoryIdentifier).toBe(RECKONING_CATEGORY);
      expect(arg.content.data.kind).toBe(RECKONING_KIND);
      expect(typeof arg.content.data.date).toBe('string');
      expect(arg.content.title).toBe(i18n.t('reckoning.notifTitle'));
      expect(arg.content.body).toBe(i18n.t('reckoning.notifBody'));
    }

    // scheduledQuoteIds diske yazılan planda quoteId sayısı kadar kayıt olmalı —
    // hesaplaşma bildirimleri o planın İÇİNDE olmamalı.
    expect((store['k:scheduled'] as unknown[]).length).toBe(quoteCalls().length);
  });
});
