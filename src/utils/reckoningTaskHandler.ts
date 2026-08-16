import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { recordReckoningAction } from '@/utils/reckoningAction';
import { nativeFeaturesAvailable } from '@/utils/runtime';

/**
 * Bildirim aksiyon butonlarının uygulama KAPALIYKEN/ARKA PLANDAYKEN işlendiği
 * headless görev adı (W0.a kararı). `index.js`te router yüklenmeden ÖNCE bu
 * modül require edilerek tanımlanır — widget task handler'la aynı gerekçe:
 * OS'un tetiklediği bir olayın çağıracağı bir şey olmalı, `expo-router/entry`
 * mount olmadan önce.
 */
export const RECKONING_BACKGROUND_TASK = 'driftstop-reckoning-action';

// Modül import edilir edilmez tanımlanır — TaskManager.defineTask'ı sonradan
// çağırmak (örn. bir React effect'i içinde) OS'un headless tetiklediği durumda
// artık çok geç olur, JS bundle'ı o effect'e hiç ulaşmadan görevi arar.
if (nativeFeaturesAvailable) {
  try {
    TaskManager.defineTask(RECKONING_BACKGROUND_TASK, async ({ data, error }) => {
      if (error) return;
      const response = data as Notifications.NotificationResponse | null | undefined;
      if (!response || typeof response.actionIdentifier !== 'string') return;
      const notifData = response.notification?.request?.content?.data as
        | { kind?: string; date?: string }
        | undefined;
      await recordReckoningAction(response.actionIdentifier, notifData);
    });
    // Tanımla + kaydet aynı modülde: docs'un önerdiği desen ("module scope of a
    // JS module which is required early"). Native modül henüz build'e girmediyse
    // (Expo Go, eski dev client) reject olur — sessizce geç, W0.a fallback
    // (`getLastNotificationResponseAsync`) zaten var.
    void Notifications.registerTaskAsync(RECKONING_BACKGROUND_TASK).catch(() => {});
  } catch {
    // native modül yok — sessizce geç
  }
}
