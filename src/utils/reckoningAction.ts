import { pruneLog, type ReckoningAnswer, type ReckoningLog } from '@/utils/reckoning';
import {
  RECKONING_ACTION_DRIFTED,
  RECKONING_ACTION_RESISTED,
  RECKONING_KIND,
} from '@/utils/scheduler';
import { getJSON, setJSON, StorageKeys } from '@/utils/storage';
import { dateKey } from '@/utils/timeUtils';

function isReckoningAnswer(id: string): id is ReckoningAnswer {
  return id === RECKONING_ACTION_RESISTED || id === RECKONING_ACTION_DRIFTED;
}

/**
 * Hesaplaşma bildirimi aksiyon cevabını `reckoningLog`a yazar. Hem foreground
 * listener (`useNotificationObserver`) hem headless background task
 * (`notificationTaskHandler`) AYNI fonksiyonu çağırır — mantık tek yerde, iki
 * tetikleyici; ikisi de çalışırsa (örn. yedek `getLastNotificationResponseAsync`
 * headless görevden SONRA da tetiklenirse) sorun değil, aynı güne üzerine yazar.
 *
 * `kind !== RECKONING_KIND` veya bilinmeyen aksiyon kimliğiyse no-op — söz
 * bildirimlerinin (W1.4) aksiyonları da aynı görevden/listener'dan geçiyor
 * (`recordQuoteAction`), biri diğerinin verisini ezmemeli.
 */
export async function recordReckoningAction(
  actionIdentifier: string,
  data: { kind?: string; date?: string } | undefined
): Promise<void> {
  if (data?.kind !== RECKONING_KIND) return;
  if (!isReckoningAnswer(actionIdentifier)) return;

  const date = typeof data.date === 'string' && data.date ? data.date : dateKey(new Date());
  const log = await getJSON<ReckoningLog>(StorageKeys.reckoningLog, {});
  const next = pruneLog({ ...log, [date]: actionIdentifier });
  await setJSON(StorageKeys.reckoningLog, next);
}
