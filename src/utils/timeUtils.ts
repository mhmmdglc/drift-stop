import type { Rng } from '@/utils/quoteSelector';
import type { Settings } from '@/types/settings';
import { MIN_WINDOW_MINUTES } from '@/types/settings';

const defaultRng: Rng = () => Math.random();

/** "09:00" gibi biçimle. */
export function formatHM(hour: number, minute: number): string {
  const h = String(hour).padStart(2, '0');
  const m = String(minute).padStart(2, '0');
  return `${h}:${m}`;
}

export function toMinutes(hour: number, minute: number): number {
  return hour * 60 + minute;
}

export function windowOf(settings: Settings): { startMin: number; endMin: number } {
  return {
    startMin: toMinutes(settings.startHour, settings.startMinute),
    endMin: toMinutes(settings.endHour, settings.endMinute),
  };
}

/** Aralık geçerli mi (bitiş, başlangıçtan >= 2 saat sonra). */
export function isValidWindow(startMin: number, endMin: number): boolean {
  return endMin - startMin >= MIN_WINDOW_MINUTES;
}

/**
 * Aktif pencere içinde `count` adet rastgele dakika (gün-içi mutlak dakika) üretir.
 * İkili aralık en az `minGap` dakika olacak şekilde. Pencere darsa gap kademeli azaltılır.
 * Saf fonksiyon — rng enjekte edilebilir (test).
 */
export function generateRandomTimes(
  startMin: number,
  endMin: number,
  count: number,
  minGap = 90,
  rng: Rng = defaultRng
): number[] {
  const span = endMin - startMin;
  if (span <= 0 || count <= 0) return [];

  // Pencereye sığacak şekilde gap'i kıs (count parça arası boşluk).
  let gap = Math.min(minGap, count > 1 ? Math.floor(span / (count - 1)) : span);
  if (gap < 0) gap = 0;

  const times: number[] = [];
  let attempts = 0;
  const maxAttempts = count * 200;

  while (times.length < count && attempts < maxAttempts) {
    attempts++;
    const candidate = startMin + Math.floor(rng() * (span + 1));
    if (times.every((t) => Math.abs(t - candidate) >= gap)) {
      times.push(candidate);
    }
    // çok denediyse gap'i biraz gevşet
    if (attempts > 0 && attempts % (count * 40) === 0 && gap > 5) {
      gap = Math.floor(gap / 2);
    }
  }

  // hâlâ eksikse benzersiz rastgelelerle tamamla
  while (times.length < count) {
    const candidate = startMin + Math.floor(rng() * (span + 1));
    if (!times.includes(candidate)) times.push(candidate);
    else if (times.length < span + 1) continue;
    else break;
  }

  return times.sort((a, b) => a - b);
}

export function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6; // Pazar veya Cumartesi
}

/** YYYY-MM-DD (yerel). */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Belirli bir gün + gün-içi dakikadan Date üretir. */
export function dateAt(base: Date, minuteOfDay: number): Date {
  const d = new Date(base);
  d.setHours(0, Math.max(0, minuteOfDay), 0, 0);
  return d;
}
