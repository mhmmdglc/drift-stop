/// <reference types="jest" />
// Tip-import derlemede silinir → jest.mock hoisting'inden etkilenmez, en üstte durabilir.
import type { Quote } from '@/types/quote';
import type { VaultMessage } from '@/utils/vault';
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
    // `utils/vault.ts` bu iki anahtarı `@/utils/storage`den okuyor — scheduler
    // onu transitif olarak import ediyor, aynı mock kayıt defterini paylaşmalı.
    vaultMessages: 'k:vault',
    scheduledVaultMessages: 'k:scheduledVault',
    // W3.2: akıllı zamanlamanın ham girdisi.
    engagementLog: 'k:engagement',
  },
  getJSON: jest.fn(async (key: string, fallback: unknown) =>
    key in store ? store[key] : fallback
  ),
  setJSON: jest.fn(async (key: string, value: unknown) => {
    store[key] = value;
  }),
}));

// Gerçek üreteçler korunuyor (`jest.requireActual`) — yalnızca HANGİ üretecin
// çağrıldığını gözlemlemek için sarmalanıyor. `pruneEngagementLog`/`hourWeights`
// de gerçek: W3.2 testleri gerçek histogram/eşik davranışını sınıyor.
jest.mock('@/utils/timeUtils', () => {
  const actual = jest.requireActual('@/utils/timeUtils');
  return {
    ...actual,
    generateRandomTimes: jest.fn(actual.generateRandomTimes),
    generateWeightedTimes: jest.fn(actual.generateWeightedTimes),
  };
});

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
  syncDeliveredVaultMessages,
  NOTIFICATION_CHANNEL_ID,
  TRIAL_CHANNEL_ID,
  TRIAL_NOTICE_KIND,
  RECKONING_KIND,
  reckoningCategoryId,
  RECKONING_ACTION_RESISTED,
  RECKONING_ACTION_DRIFTED,
  quoteCategoryId,
  QUOTE_ACTION_FAVORITE,
  QUOTE_ACTION_ONE_MORE,
  VAULT_KIND,
  VAULT_DAILY_CHANCE,
} from '../scheduler';
import { DEFAULT_SETTINGS, type Settings } from '@/types/settings';
import { dateKey, generateRandomTimes, generateWeightedTimes } from '@/utils/timeUtils';

const mockNotifications = ExpoNotifications as unknown as Record<string, jest.Mock>;
const mockGenerateRandomTimes = generateRandomTimes as jest.Mock;
const mockGenerateWeightedTimes = generateWeightedTimes as jest.Mock;

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

  it('her bildirim günlük kanala, quoteId verisiyle ve quote kategorisiyle gider', async () => {
    await applySchedule(settings({ frequency: 3 }));

    for (const call of mockNotifications.scheduleNotificationAsync.mock.calls.filter(isQuoteCall)) {
      const arg = call[0] as {
        content: { body: string; data: { quoteId: number }; categoryIdentifier: string };
        trigger: { channelId: string };
      };
      expect(arg.trigger.channelId).toBe(NOTIFICATION_CHANNEL_ID);
      expect(typeof arg.content.data.quoteId).toBe('number');
      // ❤️ / "bir tane daha" aksiyonları yalnızca bu kategoride görünür (W1.4).
      expect(arg.content.categoryIdentifier).toBe(quoteCategoryId());
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

describe('applySchedule — akıllı zamanlama (W3.2)', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  // `MIN_ENGAGEMENT_LOG_FOR_WEIGHTS` (engagement.ts) = 20 — eşiğin üstü/altı ayrımı testlerin kalbi.
  const ENOUGH = 25;
  const NOT_ENOUGH = 5;

  const mkEntries = (n: number, ageDays = 1): { hour: number; at: number }[] =>
    Array.from({ length: n }, (_, i) => ({
      hour: 14,
      at: Date.now() - ageDays * DAY_MS - i * 1000,
    }));

  it('smartTiming açık + yeterli (≥20) kayıt varken ağırlıklı üreteç kullanılır', async () => {
    store['k:engagement'] = mkEntries(ENOUGH);

    await applySchedule(settings({ smartTiming: true }));

    expect(mockGenerateWeightedTimes).toHaveBeenCalled();
    expect(mockGenerateRandomTimes).not.toHaveBeenCalled();
    // Ağırlıklar `applySchedule` başına BİR KEZ hesaplanır, 3 güne aynen uygulanır —
    // her çağrıya AYNI ağırlık nesnesi geçmeli (gün başına yeniden okunmamalı).
    const weightArgs = mockGenerateWeightedTimes.mock.calls.map((c) => c[4]);
    expect(weightArgs.length).toBeGreaterThan(0);
    for (const w of weightArgs) expect(w).toBe(weightArgs[0]);
  });

  it('smartTiming kapalıyken davranış eskisiyle AYNI — düz üreteç, log okunmaz/yazılmaz', async () => {
    const entries = mkEntries(ENOUGH);
    store['k:engagement'] = entries;
    const storageMock = jest.requireMock('@/utils/storage') as { setJSON: jest.Mock };

    await applySchedule(settings({ smartTiming: false }));

    expect(mockGenerateRandomTimes).toHaveBeenCalled();
    expect(mockGenerateWeightedTimes).not.toHaveBeenCalled();
    // Özellik kapalıyken engagementLog'a hiç dokunulmaz (mevcut davranışla bit-bit aynı).
    const engagementWrites = storageMock.setJSON.mock.calls.filter((c) => c[0] === 'k:engagement');
    expect(engagementWrites).toHaveLength(0);
    expect(store['k:engagement']).toBe(entries);
  });

  it('smartTiming açık ama kayıt < 20 iken düz üretece düşer (regresyon yok)', async () => {
    store['k:engagement'] = mkEntries(NOT_ENOUGH);

    await applySchedule(settings({ smartTiming: true }));

    expect(mockGenerateRandomTimes).toHaveBeenCalled();
    expect(mockGenerateWeightedTimes).not.toHaveBeenCalled();
  });

  it('90 günden eski kayıtları budar ve diske geri yazar', async () => {
    const fresh = mkEntries(ENOUGH, 1); // 1 gün önce → tutulur
    const stale = mkEntries(10, 91); // 91 gün önce → budanır
    store['k:engagement'] = [...fresh, ...stale];

    await applySchedule(settings({ smartTiming: true }));

    const saved = store['k:engagement'] as { hour: number; at: number }[];
    expect(saved).toHaveLength(fresh.length);
    expect(saved.every((e) => e.at >= Date.now() - 90 * DAY_MS)).toBe(true);
  });

  it('budanacak eski kayıt yoksa engagementLog gereksiz yere yeniden yazılmaz', async () => {
    store['k:engagement'] = mkEntries(ENOUGH, 1);
    const storageMock = jest.requireMock('@/utils/storage') as { setJSON: jest.Mock };

    await applySchedule(settings({ smartTiming: true }));

    const engagementWrites = storageMock.setJSON.mock.calls.filter((c) => c[0] === 'k:engagement');
    expect(engagementWrites).toHaveLength(0);
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
      reckoningCategoryId(),
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

  it('quote kategorisini AYNI çağrıda favorite + oneMore aksiyonlarıyla kaydeder — ikisi de opensAppToForeground:false', async () => {
    await setupNotificationCategories();

    expect(mockNotifications.setNotificationCategoryAsync).toHaveBeenCalledWith(quoteCategoryId(), [
      {
        identifier: QUOTE_ACTION_FAVORITE,
        buttonTitle: i18n.t('notifications.actionFavorite'),
        options: { opensAppToForeground: false },
      },
      {
        identifier: QUOTE_ACTION_ONE_MORE,
        buttonTitle: i18n.t('notifications.actionOneMore'),
        options: { opensAppToForeground: false },
      },
    ]);
    // Kategoriler birlikte pişiyor — dil değişince ikisi de yeniden kurulmalı.
    expect(mockNotifications.setNotificationCategoryAsync).toHaveBeenCalledTimes(2);
  });

  it('API reddederse sessizce geçer (eski cihaz/OS)', async () => {
    mockNotifications.setNotificationCategoryAsync.mockRejectedValueOnce(new Error('nope'));

    await expect(setupNotificationCategories()).resolves.toBeUndefined();
  });

  it('regresyon: dil değişince YENİ bir kategori kimliğiyle kaydeder, eskisini "güncellemeye" çalışmaz', async () => {
    // Bulunan bug (cihaz QA, 2026-08-16): Android, AYNI kimlikle ikinci kez
    // kaydedilen bir kategorinin buton metinlerini güncellemiyor — ilk kayıt
    // hangi dildeyse buton metinleri kalıcı olarak o dilde donuyordu (boot
    // sırasında `i18n.locale` henüz gerçek dile ayarlanmadan ilk kayıt oluyordu).
    // Kimlik artık dile göre değiştiği için "güncelleme" hiç denenmiyor, her dil
    // kendi kimliğiyle YENİ bir kategori olarak kayıtlı kalıyor.
    const originalLocale = i18n.locale;
    try {
      i18n.locale = 'tr';
      await setupNotificationCategories();
      const trCall = mockNotifications.setNotificationCategoryAsync.mock.calls.at(-1)?.[0];

      mockNotifications.setNotificationCategoryAsync.mockClear();
      i18n.locale = 'en';
      await setupNotificationCategories();
      const enCall = mockNotifications.setNotificationCategoryAsync.mock.calls.at(-1)?.[0];

      expect(trCall).not.toBe(enCall);
      expect(trCall).toBe('quote_tr');
      expect(enCall).toBe('quote_en');
    } finally {
      i18n.locale = originalLocale;
    }
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
      expect(arg.content.categoryIdentifier).toBe(reckoningCategoryId());
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

describe('applySchedule — kasa mesajları (W2.1)', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  // `Frequency` tipi yalnızca 3|5|7|10'a izin veriyor (bkz. `types/settings.ts`) — 1
  // kullanılamıyor, o yüzden `Math.random`'ı SABİT bir değerle mock'lamak güvenli değil:
  // `generateRandomTimes`in çakışma-giderme geri dönüşü (aynı aday sürekli üretilir,
  // hiçbir gap eşiğini asla geçemez) SONSUZ DÖNGÜYE düşüyor. Bunun yerine `Math.random`
  // GERÇEK bırakılıyor ve zar/istenen sonuca ulaşana kadar plan birkaç kez yeniden
  // kuruluyor — günde %25 ihtimalle 3 günde en az bir tutma olasılığı ≈ %58, aksi yönde
  // (hiç tutmama) ≈ %42, ikisi de birkaç denemede pratikte kesinleşiyor.
  const FREQ = 3;
  const EXPECTED_SLOTS = 3 * FREQ; // DAYS_AHEAD(3) × frekans — hesaplaşma HARİÇ

  const mkVaultMessage = (id: number, overrides: Partial<VaultMessage> = {}): VaultMessage => ({
    id,
    text: `vault-mesaj-${id}`,
    createdAt: Date.now() - 8 * DAY_MS, // > VAULT_SLEEP_DAYS (7) → uygun
    deliveredAt: null,
    rearmedAt: null,
    ...overrides,
  });

  const vaultCalls = () =>
    mockNotifications.scheduleNotificationAsync.mock.calls.filter(
      (c) => (c[0] as { content: { data?: { kind?: string } } }).content.data?.kind === VAULT_KIND
    );

  // Hesaplaşma dışındaki tüm bildirimler — kasa YERİNE geçtiği söz slotunu da içerir,
  // "toplam bildirim sayısı değişmez" iddiası bu toplamı ölçer.
  const slotCalls = () =>
    mockNotifications.scheduleNotificationAsync.mock.calls.filter(
      (c) => (c[0] as { content: { data?: { kind?: string } } }).content.data?.kind !== RECKONING_KIND
    );

  /** Koşul sağlanana kadar planı yeniden kurar (sonsuz döngü riskine karşı üst sınırlı). */
  async function scheduleUntil(
    predicate: () => boolean,
    maxAttempts: number,
    frequency: Settings['frequency'] = FREQ
  ): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      mockNotifications.scheduleNotificationAsync.mockClear();
      await applySchedule(settings({ frequency }));
      if (predicate()) return;
    }
  }

  beforeEach(() => {
    // Sabit bir sabah: pencere (varsayılan 09:00-21:00) test hangi saatte koşarsa
    // koşsun hep gelecekte kalsın — gerçek saate bağlı gevşek testlerden kaçınıyoruz.
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-08T08:00:00')); // Pazartesi
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it(`zar sabiti ${VAULT_DAILY_CHANCE}`, () => {
    expect(VAULT_DAILY_CHANCE).toBe(0.25);
  });

  it('uygun mesaj var ve zar tutunca bir slot kasaya ayrılır, TOPLAM bildirim sayısı DEĞİŞMEZ', async () => {
    store['k:vault'] = [mkVaultMessage(1)];

    await scheduleUntil(() => vaultCalls().length > 0, 300);

    expect(vaultCalls().length).toBeGreaterThan(0);
    expect(slotCalls()).toHaveLength(EXPECTED_SLOTS); // net artış sıfır

    const call = vaultCalls()[0][0] as {
      content: {
        title: string;
        body: string;
        subtitle: string;
        data: { kind: string; vaultId: number };
        categoryIdentifier?: string;
      };
      trigger: { channelId: string };
    };
    expect(call.content.body).toBe('vault-mesaj-1');
    expect(call.content.data).toEqual({ kind: VAULT_KIND, vaultId: 1 });
    expect(call.content.categoryIdentifier).toBeUndefined(); // ❤️/"bir tane daha" anlamsız
    expect(call.trigger.channelId).toBe(NOTIFICATION_CHANNEL_ID);
    expect(call.content.title.length).toBeGreaterThan(0); // randomTitle havuzundan, boş değil

    // Subtitle hangi plan gününe denk geldiyse (0/1/2. gün) o günün imzasıyla eşleşmeli.
    const base = new Date('2024-01-08T08:00:00');
    const possibleSubtitles = [0, 1, 2].map((offset) => {
      const day = new Date(base);
      day.setDate(base.getDate() + offset);
      const label = new Intl.DateTimeFormat(i18n.locale, { day: 'numeric', month: 'long' }).format(day);
      return i18n.t('vault.signature', { date: label });
    });
    expect(possibleSubtitles).toContain(call.content.subtitle);
  });

  it('uygun mesaj yokken hiç kasa bildirimi kurulmaz, sayı hiç değişmez', async () => {
    // Henüz 7 gün beklememiş — uygun değil. Zardan bağımsız, deterministik.
    store['k:vault'] = [mkVaultMessage(1, { createdAt: Date.now() - 1 * DAY_MS })];

    await applySchedule(settings({ frequency: FREQ }));

    expect(vaultCalls()).toHaveLength(0);
    expect(slotCalls()).toHaveLength(EXPECTED_SLOTS);
  });

  it('zar tutmadığı günlerde kasa bildirimi kurulmaz — sayı yine sabit kalır', async () => {
    store['k:vault'] = [mkVaultMessage(1)];

    await scheduleUntil(() => vaultCalls().length === 0, 300);

    expect(vaultCalls()).toHaveLength(0);
    expect(slotCalls()).toHaveLength(EXPECTED_SLOTS); // uygun mesaj olsa da sayı sabit
  });

  it("kasa bildirimi scheduledQuoteIds'e SIZMAZ, kendi diskine yazılır", async () => {
    store['k:vault'] = [mkVaultMessage(1)];

    await scheduleUntil(() => vaultCalls().length > 0, 300);

    expect(vaultCalls().length).toBeGreaterThan(0);
    const quoteCallCount = mockNotifications.scheduleNotificationAsync.mock.calls.filter(
      (c) => typeof (c[0] as { content: { data?: { quoteId?: number } } }).content.data?.quoteId === 'number'
    ).length;
    expect((store['k:scheduled'] as unknown[]).length).toBe(quoteCallCount);
    expect(store['k:scheduledVault']).toEqual(
      vaultCalls().map((c) => {
        const arg = c[0] as { content: { data: { vaultId: number } }; trigger: { date: Date } };
        return { vaultId: arg.content.data.vaultId, at: arg.trigger.date.getTime() };
      })
    );
  });

  it('3 günlük planda AYNI mesaj iki kez seçilmez — iki uygun mesaj iki farklı günde kullanılır', async () => {
    store['k:vault'] = [
      mkVaultMessage(1, { createdAt: Date.now() - 10 * DAY_MS }), // en uzun bekleyen → önce
      mkVaultMessage(2, { createdAt: Date.now() - 8 * DAY_MS }),
    ];

    await scheduleUntil(() => vaultCalls().length >= 2, 2000);

    expect(vaultCalls().length).toBeGreaterThanOrEqual(2);
    const ids = vaultCalls().map((c) => (c[0] as { content: { data: { vaultId: number } } }).content.data.vaultId);
    expect(ids).toEqual([1, 2]); // en uzun bekleyen ilk tutan günde, ikincisi bir sonraki tutan günde
    expect(new Set(ids).size).toBe(ids.length); // hiçbir mesaj plan içinde tekrar etmedi
  });

  it('regresyon: gün-0 tamamen geçmişteyken (örn. pencere zaten kapandıktan sonra yeniden planlama) mesaj o günün rastgele bir geçmiş slotuna atanıp KAYBOLMAZ', async () => {
    // Bulunan bug (code review, 2026-08-16): eski kod, vaultSlotIndex'i o günün
    // TÜM saatlerinden (geçmiştekiler dahil) seçip usedVaultIds'e HEMEN ekliyordu.
    // "now" pencere kapanışından (21:00) SONRAYSA gün-0'ın ürettiği tüm saatler
    // geçmişte kalır — zar gün-0'da tutarsa mesaj gerçek bir bildirime hiç
    // dönüşmeden "kullanıldı" sayılıp gün-1/gün-2'nin şansını da kaybederdi.
    // İstatistiksel ayrım: doğru davranışta yalnızca gün-1/gün-2 teslim
    // edebilir → P(en az bir tutma) = 1-0.75² ≈ %43.75. Bug'lı davranışta
    // gün-0'ın zarı tutan çalışmaların TAMAMI (yaklaşık %25'i) o çalışma için
    // mesajı baştan siler → P(başarı) ≈ 0.75×0.4375 ≈ %32.8. 1000 denemede
    // bu iki oran (~438 vs ~328) gürültüden (σ≈15) çok uzakta, testi kararlı kılar.
    jest.setSystemTime(new Date('2024-01-08T22:00:00')); // pencere (09:00-21:00) çoktan kapandı
    store['k:vault'] = [mkVaultMessage(1)];

    let successes = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      mockNotifications.scheduleNotificationAsync.mockClear();
      await applySchedule(settings({ frequency: FREQ }));
      if (vaultCalls().length > 0) successes++;
    }

    expect(successes).toBeGreaterThan(380); // buggy davranışın beklenen ~328'inin üstünde
  });
});

describe('syncDeliveredVaultMessages', () => {
  const mkVaultMessage = (id: number): VaultMessage => ({
    id,
    text: `vault-mesaj-${id}`,
    createdAt: 0,
    deliveredAt: null,
    rearmedAt: null,
  });

  it('teslim edilecek bir şey yoksa dokunmaz', async () => {
    store['k:scheduledVault'] = [];

    await syncDeliveredVaultMessages();

    expect(store['k:scheduledVault']).toEqual([]);
  });

  it('fire zamanı geçmiş kayıtları markDelivered\'a yönlendirir ve listeden düşürür', async () => {
    const past = Date.now() - 60_000;
    const future = Date.now() + 60_000;
    store['k:vault'] = [mkVaultMessage(1), mkVaultMessage(2)];
    store['k:scheduledVault'] = [
      { vaultId: 1, at: past },
      { vaultId: 2, at: future },
    ];

    await syncDeliveredVaultMessages();

    const messages = store['k:vault'] as VaultMessage[];
    expect(messages.find((m) => m.id === 1)?.deliveredAt).toBe(past);
    expect(messages.find((m) => m.id === 2)?.deliveredAt).toBeNull(); // gelecekteki henüz teslim değil
    // Gelecekteki kayıt korunmalı; silinirse o bildirim geldiğinde hiç işaretlenmez.
    expect(store['k:scheduledVault']).toEqual([{ vaultId: 2, at: future }]);
  });

  it('zaten teslim edilmiş bir mesaja tekrar dokunmaz (markDelivered idempotent)', async () => {
    store['k:vault'] = [{ ...mkVaultMessage(1), deliveredAt: 111 }];
    store['k:scheduledVault'] = [{ vaultId: 1, at: Date.now() - 1000 }];

    await syncDeliveredVaultMessages();

    const messages = store['k:vault'] as VaultMessage[];
    expect(messages.find((m) => m.id === 1)?.deliveredAt).toBe(111);
  });
});
