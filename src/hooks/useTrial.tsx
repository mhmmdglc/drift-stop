import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import {
  computeTrialState,
  loadTrialEndedShown,
  markTrialEndedShown,
  startTrialIfNeeded,
  TRIAL_DAYS,
  type TrialState,
} from '@/services/trial';
import { reconcileTrialWithServer } from '@/services/trialSync';

type TrialContextValue = TrialState & {
  /**
   * Damga diskten okundu mu. `false` iken deneme hakkında HİÇBİR ŞEY bilinmiyor —
   * `useEntitlement` bu durumda `entitlementKnown: false` döndürür, yani yıkıcı
   * akışlar (premium cache temizliği) çalışmaz. Bu bayrağı atlamak, denemedeki
   * kullanıcının önbelleğini her açılışın ilk anında silmek demekti.
   */
  loaded: boolean;
  /** Deneme bitti ve `/trial-ended` ekranı henüz gösterilmedi. */
  endedNeedsNotice: boolean;
  acknowledgeEnded: () => void;
};

const TrialContext = createContext<TrialContextValue | null>(null);

/** Bir sonraki yerel gece yarısına kalan ms. */
function msUntilLocalMidnight(now: number): number {
  const d = new Date(now);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 5, 0);
  return Math.max(1000, next.getTime() - now);
}

export function TrialProvider({ children }: { children: ReactNode }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [endedShown, setEndedShown] = useState(true);
  /**
   * "Şimdi"nin anlık görüntüsü. `Date.now()` render sırasında OKUNMAZ (impure);
   * yalnızca effect ve olay geri çağrılarında tazelenir. 0 = henüz okunmadı,
   * `loaded` false olduğu için bu değer hiçbir karara girmez.
   */
  const [now, setNow] = useState(0);
  const { user } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    let active = true;
    void (async () => {
      // Deneme ilk açılışta başlar. Zaten başlamışsa damga korunur.
      const [ts, shown] = await Promise.all([startTrialIfNeeded(Date.now()), loadTrialEndedShown()]);
      if (!active) return;
      setStartedAt(ts);
      setEndedShown(shown);
      setNow(Date.now());
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  /**
   * Oturum açıldığında denemeyi sunucuyla uzlaştır (bkz. `services/trialSync.ts`).
   * İki işi var: premium sözlerin RLS altında inebilmesi için `trials` satırını
   * yazmak, ve sunucuda satır varsa cihazı ona hizalamak (yeniden kurulumla
   * denemenin uzatılmasını engeller).
   */
  useEffect(() => {
    if (!loaded || !userId || startedAt == null) return;
    let active = true;
    void (async () => {
      const { startedAt: reconciled } = await reconcileTrialWithServer(userId, startedAt);
      if (!active || reconciled === startedAt) return;
      setStartedAt(reconciled);
      setNow(Date.now());
    })();
    return () => {
      active = false;
    };
  }, [loaded, userId, startedAt]);

  // Gün sınırı iki yolla geçilebilir: uygulama arka plandayken (foreground'a
  // dönüşte yeniden hesapla) ve uygulama açıkken gece yarısı (zamanlayıcı).
  // Sadece AppState'e bakan bir sürüm, geceyi açık uygulamayla geçiren kullanıcıda
  // denemeyi hiç bitirmezdi.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setNow(Date.now());
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (now === 0) return;
    const timer = setTimeout(() => setNow(Date.now()), msUntilLocalMidnight(now));
    return () => clearTimeout(timer);
  }, [now]);

  const state = useMemo(() => computeTrialState(startedAt, now), [startedAt, now]);

  const acknowledgeEnded = useCallback(() => {
    setEndedShown(true);
    void markTrialEndedShown();
  }, []);

  const value = useMemo<TrialContextValue>(
    () => ({
      ...state,
      loaded,
      // Damga yoksa deneme hiç başlamadı; bitiş ekranı da anlamsız.
      endedNeedsNotice: loaded && state.startedAt != null && !state.active && !endedShown,
      acknowledgeEnded,
    }),
    [state, loaded, endedShown, acknowledgeEnded]
  );

  return <TrialContext.Provider value={value}>{children}</TrialContext.Provider>;
}

export function useTrial(): TrialContextValue {
  const ctx = useContext(TrialContext);
  if (!ctx) throw new Error('useTrial, TrialProvider içinde kullanılmalı.');
  return ctx;
}

export { TRIAL_DAYS };
