import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { getQuoteById, getQuotesByThemes } from '@/data/quotes';
import { useSettings } from '@/hooks/useSettings';
import type { Quote } from '@/types/quote';
import { randomIndex } from '@/utils/quoteSelector';
import { syncDeliveredToHistory } from '@/utils/scheduler';
import { getJSON, setJSON, StorageKeys } from '@/utils/storage';

const CAP = 200; // en fazla bu kadar geçmiş tutulur

type HistoryContextValue = {
  quote: Quote | undefined;
  count: number;
  loaded: boolean;
  /** Yeni görülen sözü geçmişe ekle (bildirim/açılış). */
  record: (id: number) => void;
  goOlder: () => void;
  goNewer: () => void;
  randomFromHistory: () => void;
  canOlder: boolean;
  canNewer: boolean;
};

const HistoryContext = createContext<HistoryContextValue | null>(null);

/**
 * Kullanıcının GÖRDÜĞÜ sözlerin geçmişi. Uygulama yeni söz "üretmez" —
 * yeni sözler bildirimlerle gelir. İçeride sadece geçmiş gezilir / geçmişten rastgele çekilir.
 */
export function HistoryProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [history, setHistory] = useState<number[]>([]);
  const [pointer, setPointer] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      // Önce bildirimle gelen (teslim edilmiş) sözleri geçmişe taşı, sonra yükle.
      await syncDeliveredToHistory().catch(() => null);
      const stored = await getJSON<number[]>(StorageKeys.seenHistory, []);
      if (!active) return;
      let next = stored;
      if (next.length === 0) {
        // ilk açılış: tek bir başlangıç sözü (seçili temalardan). Gerisi için sabret.
        const pool = getQuotesByThemes(settings.themes);
        next = [pool[randomIndex(pool.length)].id];
        void setJSON(StorageKeys.seenHistory, next);
      }
      setHistory(next);
      setPointer(0);
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
    // sadece ilk yüklemede seed; themes sonradan değişse de geçmiş korunur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Uygulama öne geldiğinde, arka planda gelen bildirimlerin sözlerini geçmişe ekle.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      syncDeliveredToHistory()
        .then((next) => {
          if (next) {
            setHistory(next);
            setPointer(0);
          }
        })
        .catch(() => {});
    });
    return () => sub.remove();
  }, []);

  const record = useCallback((id: number) => {
    setHistory((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, CAP);
      void setJSON(StorageKeys.seenHistory, next);
      return next;
    });
    setPointer(0); // en yeni göster
  }, []);

  const goOlder = useCallback(
    () => setPointer((p) => Math.min(p + 1, history.length - 1)),
    [history.length]
  );
  const goNewer = useCallback(() => setPointer((p) => Math.max(p - 1, 0)), []);
  const randomFromHistory = useCallback(() => {
    setPointer((p) => (history.length <= 1 ? p : randomIndex(history.length, p)));
  }, [history.length]);

  const quoteId = history[pointer];
  const quote = quoteId != null ? getQuoteById(quoteId) : undefined;

  const value = useMemo<HistoryContextValue>(
    () => ({
      quote,
      count: history.length,
      loaded,
      record,
      goOlder,
      goNewer,
      randomFromHistory,
      canOlder: pointer < history.length - 1,
      canNewer: pointer > 0,
    }),
    [quote, history.length, loaded, record, goOlder, goNewer, randomFromHistory, pointer]
  );

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistory(): HistoryContextValue {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error('useHistory, HistoryProvider içinde kullanılmalı.');
  return ctx;
}
