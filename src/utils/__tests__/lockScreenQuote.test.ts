jest.mock('expo-notifications', () => ({
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue(undefined),
  dismissNotificationAsync: jest.fn().mockResolvedValue(undefined),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: { MIN: 1, LOW: 2, DEFAULT: 3, HIGH: 4 },
  AndroidNotificationPriority: { MIN: 'min', LOW: 'low', DEFAULT: 'default' },
}));
jest.mock('@/utils/runtime', () => ({ nativeFeaturesAvailable: true, isExpoGo: false }));


import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { QUOTES } from '@/data/quotes';
import {
  LOCK_SCREEN_CHANNEL_ID,
  LOCK_SCREEN_NOTIFICATION_ID,
  syncLockScreenQuote,
} from '@/utils/lockScreenQuote';

const mock = Notifications as unknown as Record<string, jest.Mock>;
const ID = QUOTES[0].id;

// Özellik Android'e özel; jest-expo varsayılan olarak iOS platformunda koşuyor.
beforeAll(() => {
  Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });
});

beforeEach(() => jest.clearAllMocks());

describe('kilit ekranı sözü', () => {
  it('açıkken sözü kalıcı ve sessiz olarak gösterir', async () => {
    await syncLockScreenQuote(true, ID);

    const arg = mock.scheduleNotificationAsync.mock.calls[0][0];
    expect(arg.identifier).toBe(LOCK_SCREEN_NOTIFICATION_ID);
    // Kanal trigger üzerinden veriliyor; null trigger fallback kanala (HIGH, sesli) düşürüyor.
    expect(arg.trigger).toEqual({ channelId: LOCK_SCREEN_CHANNEL_ID });
    // Kaydırılıp atılamamalı, dokununca kaybolmamalı.
    expect(arg.content.sticky).toBe(true);
    expect(arg.content.autoDismiss).toBe(false);
    expect(arg.content.priority).toBe(Notifications.AndroidNotificationPriority.DEFAULT);
    expect(arg.content.title.length).toBeGreaterThan(0);
    expect(arg.content.body).toMatch(/^— /);
  });

  // MIN/LOW önem Android 16 kilit ekranında bildirimi küçük bir daireye indiriyor
  // ve söz okunmuyor. Görünürlük için DEFAULT şart; sessizlik sound/vibrate ile.
  it('kanal DEFAULT önemde ama tamamen sessiz', async () => {
    await syncLockScreenQuote(true, ID);

    const [channelId, channel] = mock.setNotificationChannelAsync.mock.calls[0];
    expect(channelId).toBe(LOCK_SCREEN_CHANNEL_ID);
    expect(channel.importance).toBe(Notifications.AndroidImportance.DEFAULT);
    expect(channel.sound).toBeNull();
    expect(channel.enableVibrate).toBe(false);
    expect(channel.vibrationPattern).toBeNull();
    expect(channel.showBadge).toBe(false);
  });

  it('kapalıyken bildirimi kaldırır ve yenisini göstermez', async () => {
    await syncLockScreenQuote(false, ID);

    expect(mock.dismissNotificationAsync).toHaveBeenCalledWith(LOCK_SCREEN_NOTIFICATION_ID);
    expect(mock.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('gösterilecek söz yoksa bildirim kurmaz', async () => {
    await syncLockScreenQuote(true, null);
    expect(mock.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('bildirim izni reddedilse bile çökmez', async () => {
    mock.scheduleNotificationAsync.mockRejectedValueOnce(new Error('denied'));
    await expect(syncLockScreenQuote(true, ID)).resolves.toBeUndefined();
  });
});
