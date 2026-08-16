import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getJSON, setJSON, StorageKeys } from '@/utils/storage';

/** Favori söz id'lerini AsyncStorage'da tutar. */
export function useFavorites() {
  const [ids, setIds] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(false);
  // `persist()`in fire-and-forget diske yazımını izler — aşağıdaki AppState
  // dinleyicisi okumadan önce bunu bekler.
  const pendingWrite = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    getJSON<number[]>(StorageKeys.favorites, []).then((stored) => {
      if (active) {
        setIds(stored);
        setLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Bildirimden ❤️ aksiyonuyla (W1.4) arka planda eklenen bir favori, uygulama
  // açık dururken görünmez ve bir sonraki state yazımı onu ezer — `useHistory.tsx`
  // ile aynı gerekçe/desen: öne gelince en güncel diskten oku. ÖNCE `pendingWrite`i
  // bekliyoruz: kullanıcı tam bu anda bir favoriyi siliyorsa (`persist()` diske
  // henüz inmemiş fire-and-forget bir yazım başlatmışken bir `AppState` geçişi
  // gelirse) bekleme olmadan okumak o silmeyi geri getirebiliyordu — `persist`
  // her zaman EN SON bilinen state'i senkron olarak `ids`e yazdığı için, disk
  // yazımının inmesini beklemek asla bir kullanıcı aksiyonunu kaybettirmez,
  // sadece okuma sırasını doğru yapar (code review, 2026-08-16).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      pendingWrite.current
        .then(() => getJSON<number[]>(StorageKeys.favorites, []))
        .then(setIds)
        .catch(() => {});
    });
    return () => sub.remove();
  }, []);

  const persist = useCallback((next: number[]) => {
    setIds(next);
    // Önceki yazımın ÜZERİNE değil ARDINA zincirlenir — art arda hızlı iki
    // `persist()` çağrısı (örn. iki hızlı dokunuş) diske YARIŞMADAN, çağrı
    // sırasıyla yazılır. `setJSON` kendi hatasını yutar (asla reddetmez),
    // o yüzden zincir asla kopmaz (ikinci code review turu, 2026-08-16 —
    // önceki sürüm `pendingWrite`i zincirlemek yerine DEĞİŞTİRİYORDU).
    pendingWrite.current = pendingWrite.current.then(() => setJSON(StorageKeys.favorites, next));
  }, []);

  const isFavorite = useCallback((id: number) => ids.includes(id), [ids]);

  const toggle = useCallback(
    (id: number) => {
      persist(ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids]);
    },
    [ids, persist]
  );

  const remove = useCallback(
    (id: number) => {
      persist(ids.filter((x) => x !== id));
    },
    [ids, persist]
  );

  return { ids, isFavorite, toggle, remove, loaded };
}
