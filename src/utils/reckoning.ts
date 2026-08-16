import { dateKey, isWeekend } from '@/utils/timeUtils';

/** Bir günün beyanı: direndim mi kaçtım mı. Cevapsız gün log'da hiç anahtar taşımaz. */
export type ReckoningAnswer = 'resisted' | 'drifted';

/** `dateKey` biçimli tarih → cevap. */
export type ReckoningLog = Record<string, ReckoningAnswer>;

export type WeekSummary = {
  resisted: number;
  drifted: number;
  unanswered: number;
  /** Cevaplanabilir gün sayısı — `disableWeekends` açıksa hafta sonu günleri düşer, payda 7 SABİT DEĞİL. */
  total: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** Log kaç gün saklanır — bundan eskisi `pruneLog` ile silinir. */
const LOG_MAX_AGE_DAYS = 90;

/**
 * `dateKey` metnini yerel-saat `Date`'e çevirir (saat dilimi kaymasına karşı Y/M/D
 * bileşenlerinden kurar — `new Date("YYYY-MM-DD")` UTC yorumlar, gün kayabilir).
 * Ekran katmanı (haftalık şerit render'ı) da bunu kullanır, o yüzden export edildi.
 */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Bir gün önceki `dateKey`. */
function prevDateKey(key: string): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() - 1);
  return dateKey(d);
}

/**
 * Bugünden (bugün cevapsızsa dünden) geriye kesintisiz `resisted` sayısı.
 *
 * Ürün kararı (tartışılmaz, `w1.3-ux.md`): `drifted` VE cevapsız gün ikisi de zinciri
 * kırar — hesaplaşmadan kaçmak da kaçmaktır. Ama BUGÜN henüz cevaplanmadıysa gün henüz
 * bitmediği için bugünü saymadan/kırmadan dünden başlanır (aksi halde her sabah, kullanıcı
 * henüz cevap vermeden streak sıfır görünür — yanlış sinyal).
 */
export function computeStreak(
  log: ReckoningLog,
  today: string,
  disableWeekends = false
): number {
  const todayAnswer = log[today];
  if (todayAnswer === 'drifted') return 0;

  let streak = 0;
  let cursor = today;
  if (todayAnswer === 'resisted') {
    streak = 1;
  }
  cursor = prevDateKey(cursor);

  // Log sonlu (90 günle budanır) → `log[cursor]` bir noktada undefined olur ve döngü kırılır.
  for (;;) {
    if (disableWeekends && isWeekend(parseDateKey(cursor))) {
      cursor = prevDateKey(cursor);
      continue;
    }
    if (log[cursor] !== 'resisted') break;
    streak++;
    cursor = prevDateKey(cursor);
  }

  return streak;
}

/**
 * Bugün dahil son 7 günün özeti. `total`, `disableWeekends` açıkken hafta sonu
 * günlerini dışlar — "Bu hafta 5/7" gösterimi muaf günleri kaçış gibi saymasın diye.
 */
export function weekSummary(
  log: ReckoningLog,
  today: string,
  disableWeekends = false
): WeekSummary {
  let resisted = 0;
  let drifted = 0;
  let unanswered = 0;
  let total = 0;
  let cursor = today;

  for (let i = 0; i < 7; i++) {
    if (!(disableWeekends && isWeekend(parseDateKey(cursor)))) {
      total++;
      const answer = log[cursor];
      if (answer === 'resisted') resisted++;
      else if (answer === 'drifted') drifted++;
      else unanswered++;
    }
    cursor = prevDateKey(cursor);
  }

  return { resisted, drifted, unanswered, total };
}

/**
 * 90 günden eski kayıtları siler — log sonsuza kadar büyümesin (favorites/history
 * ile aynı "cap" gerekçesi, burada tarihe göre budanıyor çünkü anahtar tarih).
 * `now` test için enjekte edilebilir.
 */
export function pruneLog(log: ReckoningLog, now: Date = new Date()): ReckoningLog {
  const cutoff = now.getTime() - LOG_MAX_AGE_DAYS * DAY_MS;
  const next: ReckoningLog = {};
  for (const key of Object.keys(log)) {
    if (parseDateKey(key).getTime() >= cutoff) {
      next[key] = log[key];
    }
  }
  return next;
}
