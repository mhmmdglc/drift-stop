import { useCallback, useEffect, useMemo, useState } from 'react';

import { getAllCachedPacks } from '@/db/packsCache';
import { getCachedPackQuoteCounts, getCachedPremiumAuthors } from '@/db/quotesCache';
import { syncPacks } from '@/services/packsSync';
import { usePurchases } from '@/hooks/usePurchases';
import type { QuotePack } from '@/types/quotePack';

export type PackWithState = QuotePack & {
  quoteCount: number;
  /** Kullanıcı bu paketi görüntüleyebilir mi (Pro değilse ve paket premium'sa kilitli). */
  locked: boolean;
};

export type AuthorWithState = {
  author: string;
  quoteCount: number;
  /** Tüm premium içerik Pro'ya bağlı — Pro değilse her yazar kilitli. */
  locked: boolean;
};

/**
 * Faz 4 — premium içerik paketleri listesini yönetir. Paket meta verisi +
 * söz sayıları yerel cache'ten okunur (offline-first, senkron/render sırasında
 * hesaplanır); mount'ta ayrıca arka planda Supabase'ten tazelenir (ağ yoksa
 * sessizce vazgeçer).
 */
export function usePacks() {
  const { isPro } = usePurchases();
  const [loading, setLoading] = useState(true);
  // syncPacks() her tamamlandığında artırılır → aşağıdaki useMemo cache'i yeniden okur.
  const [version, setVersion] = useState(0);

  const packs = useMemo<PackWithState[]>(() => {
    const rawPacks = getAllCachedPacks();
    const counts = getCachedPackQuoteCounts();
    return rawPacks.map((p) => ({
      ...p,
      quoteCount: counts[p.id] ?? 0,
      locked: p.isPremium && !isPro,
    }));
    // `version` sadece yeniden-okuma tetiklemek için bağımlılık; değeri kullanılmıyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro, version]);

  const authors = useMemo<AuthorWithState[]>(() => {
    return getCachedPremiumAuthors().map((a) => ({
      author: a.author,
      quoteCount: a.count,
      locked: !isPro,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro, version]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await syncPacks();
    setVersion((v) => v + 1);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async senkron, `useHistory`/`usePurchases`'taki mevcut kalıp
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { packs, authors, loading, refresh };
}
