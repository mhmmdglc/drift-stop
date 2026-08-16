import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useSettings } from '@/hooks/useSettings';
import {
  computeStreak,
  pruneLog,
  weekSummary,
  type ReckoningAnswer,
  type ReckoningLog,
} from '@/utils/reckoning';
import { getJSON, setJSON, StorageKeys } from '@/utils/storage';
import { dateKey } from '@/utils/timeUtils';

/**
 * `reckoningLog`u okur/yazar ve türetilen streak/haftalık özeti sağlar. Home
 * şeridi ve `/reckoning` İKİSİ de bu hook'u kullanır (state tekrarını önler,
 * `useFavorites` gibi provider DEĞİL — ekranlar arası anlık senkron gerekmiyor,
 * `useFocusEffect` her odaklanmada diskten tazeler, `/reckoning` modal'ı
 * kapandığında Home bir sonraki focus'ta güncel görünür).
 */
export function useReckoning() {
  const { settings } = useSettings();
  const [log, setLog] = useState<ReckoningLog>({});
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(() => {
    let active = true;
    getJSON<ReckoningLog>(StorageKeys.reckoningLog, {}).then((stored) => {
      if (active) {
        setLog(stored);
        setLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(reload);

  const answer = useCallback((value: ReckoningAnswer) => {
    const today = dateKey(new Date());
    setLog((prev) => {
      const next = pruneLog({ ...prev, [today]: value });
      void setJSON(StorageKeys.reckoningLog, next);
      return next;
    });
  }, []);

  const today = dateKey(new Date());
  const streak = computeStreak(log, today, settings.disableWeekends);
  const week = weekSummary(log, today, settings.disableWeekends);
  const answeredToday = log[today] ?? null;
  const hasAnyAnswer = Object.keys(log).length > 0;

  return { loaded, log, today, streak, week, answeredToday, hasAnyAnswer, answer };
}
