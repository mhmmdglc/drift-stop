import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { recordReckoningAction } from '@/utils/reckoningAction';
import { nativeFeaturesAvailable } from '@/utils/runtime';
import { RECKONING_KIND } from '@/utils/scheduler';

// Uygulama ön plandayken bildirim nasıl gösterilsin (Expo Go'da çağırma → çökme)
if (nativeFeaturesAvailable) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // native modül yok — sessizce geç
  }
}

type NotificationData = { quoteId?: number; kind?: string; date?: string };

function extractData(response: Notifications.NotificationResponse | null): NotificationData {
  return (response?.notification?.request?.content?.data as NotificationData | undefined) ?? {};
}

/**
 * Bildirime tıklanınca ilgili sözü açar (/quote/[id]) veya, hesaplaşma
 * bildirimiyse aksiyona/gövdeye göre davranır:
 * - Aksiyon butonu (`resisted`/`drifted`): `reckoningLog`a sessizce yazar,
 *   YÖNLENDİRME YAPMAZ — "tek dokunuşla günü kapat" vaadinin karşılığı budur.
 *   Headless background task (`reckoningTaskHandler`) aynı işi uygulama
 *   kapalıyken zaten yapmış olabilir; `recordReckoningAction` aynı güne
 *   üzerine yazar, çift çağrı zararsız (W0.a yedek yolu budur).
 * - Gövdeye dokunma (DEFAULT): `/reckoning`e götürür, söz yönlendirmesi yapılmaz.
 * Expo Go'da no-op (native bildirim yok).
 */
export function useNotificationObserver() {
  const router = useRouter();

  useEffect(() => {
    if (!nativeFeaturesAvailable) return;
    let mounted = true;

    const handle = async (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const data = extractData(response);

      if (data.kind === RECKONING_KIND) {
        if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          if (mounted) router.push('/reckoning');
        } else {
          await recordReckoningAction(response.actionIdentifier, data);
        }
        return;
      }

      if (typeof data.quoteId === 'number' && mounted) {
        router.push(`/quote/${data.quoteId}`);
      }
    };

    try {
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (mounted) void handle(response);
      });
    } catch {
      // sessizce geç
    }

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      void handle(response);
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, [router]);
}
