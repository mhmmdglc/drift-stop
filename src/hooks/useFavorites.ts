import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getJSON, setJSON, StorageKeys } from '@/utils/storage';

/** Favori söz id'lerini AsyncStorage'da tutar. */
export function useFavorites() {
  const [ids, setIds] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(false);

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
  // ile aynı gerekçe/desen: öne gelince en güncel diskten oku.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      getJSON<number[]>(StorageKeys.favorites, [])
        .then(setIds)
        .catch(() => {});
    });
    return () => sub.remove();
  }, []);

  const persist = useCallback((next: number[]) => {
    setIds(next);
    void setJSON(StorageKeys.favorites, next);
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
