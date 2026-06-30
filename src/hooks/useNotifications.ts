import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { nativeFeaturesAvailable } from '@/utils/runtime';

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

function extractQuoteId(response: Notifications.NotificationResponse | null): number | null {
  const data = response?.notification?.request?.content?.data as
    | { quoteId?: number }
    | undefined;
  const id = data?.quoteId;
  return typeof id === 'number' ? id : null;
}

/**
 * Bildirime tıklanınca ilgili sözü açar (/quote/[id]).
 * Expo Go'da no-op (native bildirim yok).
 */
export function useNotificationObserver() {
  const router = useRouter();

  useEffect(() => {
    if (!nativeFeaturesAvailable) return;
    let mounted = true;

    const redirect = (response: Notifications.NotificationResponse | null) => {
      const quoteId = extractQuoteId(response);
      if (quoteId != null) {
        router.push(`/quote/${quoteId}`);
      }
    };

    try {
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (mounted) redirect(response);
      });
    } catch {
      // sessizce geç
    }

    const sub = Notifications.addNotificationResponseReceivedListener(redirect);

    return () => {
      mounted = false;
      sub.remove();
    };
  }, [router]);
}
