import { useCallback, useEffect, useState } from 'react';

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
