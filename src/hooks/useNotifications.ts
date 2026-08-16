import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { recordEngagement, recordQuoteAction } from '@/utils/quoteAction';
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
 * - Hesaplaşma aksiyon butonu (`resisted`/`drifted`): `reckoningLog`a sessizce
 *   yazar, YÖNLENDİRME YAPMAZ — "tek dokunuşla günü kapat" vaadinin karşılığı
 *   budur. Headless background task (`notificationTaskHandler`) aynı işi
 *   uygulama kapalıyken zaten yapmış olabilir; `recordReckoningAction` aynı
 *   güne üzerine yazar, çift çağrı zararsız (W0.a yedek yolu budur).
 * - Hesaplaşma gövdesine dokunma (DEFAULT): `/reckoning`e götürür, söz
 *   yönlendirmesi yapılmaz.
 * - Söz bildirimi aksiyon butonu (`favorite`/`oneMore`, W1.4): `recordQuoteAction`
 *   sessizce işler, sözü AÇMAZ — aynı "uygulamayı açmadan etkileşim" vaadi.
 * - Söz bildirimi gövdesine dokunma (DEFAULT): mevcut davranış (`/quote/[id]`)
 *   korunur, ek olarak `engagementLog`a dokunma anı yazılır (W3.2'nin girdisi).
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

      if (typeof data.quoteId === 'number') {
        if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          await recordEngagement();
          if (mounted) router.push(`/quote/${data.quoteId}`);
        } else {
          // notificationId: bildirimin kendi `identifier`'ı — `recordQuoteAction`
          // "bir tane daha"nın kalıcı tekilleştirmesinde kullanır (bkz. quoteAction.ts).
          await recordQuoteAction(response.actionIdentifier, data, response.notification.request.identifier);
        }
      }
    };

    try {
      Notifications.getLastNotificationResponseAsync().then(async (response) => {
        // ÖNCE işle, SONRA temizle — tersi, işleme bitmeden temizlenip cevabın
        // hem işlenmemiş hem de bir daha asla görünmeyecek şekilde kaybolduğu
        // bir pencere açardı (ikinci code review turu, 2026-08-16). Native taraf
        // bu cevabı temizlenmeden sonraki soğuk başlatmalarda da döndürmeye
        // devam eder — `oneMore` gibi yan etkili aksiyonların süreç değişse bile
        // tekrar işlenmemesinin asıl garantisi artık `quoteAction.ts`teki kalıcı
        // `processedOneMoreIds` tekilleştirmesi; bu temizleme ona ek bir katman.
        if (mounted) await handle(response);
        if (response) await Notifications.clearLastNotificationResponseAsync().catch(() => {});
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
