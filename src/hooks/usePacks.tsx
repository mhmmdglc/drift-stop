import { useCallback, useEffect, useMemo, useState } from 'react';

import { getAllCachedPacks, getCachedPremiumAuthorCounts } from '@/db/packsCache';
import { syncAuthorCounts } from '@/services/authorsSync';
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

  // Ham cache satırları. Okuma RENDER SIRASINDA yapılmıyor: bu iki sorgu
  // `useMemo` içinde senkron SQLite I/O'suydu ve her render'ı bloke ediyordu.
  // Sorgular küçük (18 paket, ~104 yazar) ama render yolunda senkron I/O yapmanın
  // doğru olduğu bir boyut yok — ucuz cihazda kare düşürür.
  const [rawPacks, setRawPacks] = useState<QuotePack[]>([]);
  const [rawAuthors, setRawAuthors] = useState<{ author: string; quoteCount: number }[]>([]);

  // Kilit durumu türetilmiş veri — entitlement değişince cache'i yeniden
  // okumaya gerek yok, sadece bayrağı yeniden hesaplamak yeter.
  const packs = useMemo<PackWithState[]>(
    () => rawPacks.map((p) => ({ ...p, locked: p.isPremium && !isPro })),
    [rawPacks, isPro]
  );

  const authors = useMemo<AuthorWithState[]>(
    () =>
      // Herkese açık RPC'den senkronize edilen sayılar (bkz. authorsSync.ts) —
      // free/guest kullanıcı da bu bölümü (kilitli haliyle) görebilsin diye
      // gerçek söz içeriğinin senkronize olup olmamasına bağlı DEĞİL.
      rawAuthors.map((a) => ({ author: a.author, quoteCount: a.quoteCount, locked: !isPro })),
    [rawAuthors, isPro]
  );

  const readCache = useCallback(() => {
    setRawPacks(getAllCachedPacks());
    setRawAuthors(getCachedPremiumAuthorCounts());
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    // Önce commit'ten çık, sonra cache'i oku: aksi halde SQLite yine render/commit
    // fazında çalışır ve bu değişikliğin amacı boşa gider.
    await Promise.resolve();
    readCache(); // offline-first: ağdan önce elimizdekini göster
    await Promise.all([syncPacks(), syncAuthorCounts()]);
    readCache(); // senkron sonrası tazelenmiş hali
    setLoading(false);
  }, [readCache]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async senkron, `useHistory`/`usePurchases`'taki mevcut kalıp
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { packs, authors, loading, refresh };
}
