import type { EngagementEntry } from '@/utils/quoteAction';

/**
 * `hourWeights` için minimum kayıt eşiği (spec kararı, W3.2). Bunun altında
 * histogram gürültüden ibaret sayılır — `null` dönülür ve scheduler düz
 * `generateRandomTimes`'a düşer.
 */
export const MIN_ENGAGEMENT_LOG_FOR_WEIGHTS = 20;

/** `pruneEngagementLog` varsayılan yaş sınırı (gün). */
export const ENGAGEMENT_LOG_MAX_AGE_DAYS = 90;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * `engagementLog`'dan saat başına (0-23) ağırlık histogramı çıkarır. Her kayıt
 * kendi saatine 1, komşu iki saate (±1) 0.5 ekler — komşu saatlere yumuşatma,
 * kullanıcı "21:58"de okuduğunda 22:xx'in de bir miktar ağırlık kazanması için
 * (tam saat sınırında keskin kesim, gerçek davranışı yanlış temsil eder).
 * Kayıt < 20 ise `null` — yetersiz veriyle saat "öğrenmiş" gibi davranmayalım.
 */
export function hourWeights(log: EngagementEntry[]): Record<number, number> | null {
  if (log.length < MIN_ENGAGEMENT_LOG_FOR_WEIGHTS) return null;

  const weights: Record<number, number> = {};
  for (let h = 0; h < 24; h++) weights[h] = 0;

  for (const entry of log) {
    // saat 0-23 dışında bir değer gelirse (bozuk kayıt) sarmalayarak normalize et
    const hour = ((entry.hour % 24) + 24) % 24;
    weights[hour] += 1;
    weights[(hour + 1) % 24] += 0.5;
    weights[(hour + 23) % 24] += 0.5; // (hour - 1) mod 24
  }

  return weights;
}

/**
 * 90 günden eski kayıtları atar — eski alışkanlıklar süresiz ağırlık taşımasın,
 * kullanıcının okuma saatleri zamanla kayarsa histogram onu izleyebilsin.
 * Sınırda kalan kayıt (tam 90 gün) TUTULUR, 91 gün ve üzeri düşer.
 */
export function pruneEngagementLog(
  log: EngagementEntry[],
  now: number,
  maxAgeDays: number = ENGAGEMENT_LOG_MAX_AGE_DAYS
): EngagementEntry[] {
  const cutoff = now - maxAgeDays * MS_PER_DAY;
  return log.filter((entry) => entry.at >= cutoff);
}
