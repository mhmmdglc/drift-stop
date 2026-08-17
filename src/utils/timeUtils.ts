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

/**
 * Akıllı zamanlama karışım oranı — %30 ağırlıklı saat seçimi, %70 tamamen
 * uniform (spec kararı, W3.2). Tamamen tahmin edilebilir hale gelmesin diye
 * ağırlık asla %100 olmuyor; "beklenmedik an" vaadi korunuyor.
 */
export const SMART_TIMING_MIX = 0.3;

/**
 * `weights` ile ağırlıklandırılmış pencere içinden bir saat seçip (ağırlık
 * toplamı 0'sa saatler arasında uniform), o saatin pencereyle kesişen kısmında
 * rastgele bir dakika döndürür.
 */
function pickWeightedMinute(
  startMin: number,
  endMin: number,
  weights: Record<number, number>,
  rng: Rng
): number {
  const startHour = Math.floor(startMin / 60);
  const endHour = Math.min(23, Math.floor(endMin / 60));
  const hours: number[] = [];
  for (let h = startHour; h <= endHour; h++) hours.push(h);
  if (hours.length === 0) hours.push(startHour);

  const hourWeightsInWindow = hours.map((h) => Math.max(0, weights[h] ?? 0));
  const total = hourWeightsInWindow.reduce((a, b) => a + b, 0);

  let hour: number;
  if (total <= 0) {
    // pencerede hiç ağırlıklı saat yoksa (ör. hepsi 0) uniform saat seç
    hour = hours[Math.floor(rng() * hours.length)];
  } else {
    let r = rng() * total;
    hour = hours[hours.length - 1];
    for (let i = 0; i < hours.length; i++) {
      r -= hourWeightsInWindow[i];
      if (r <= 0) {
        hour = hours[i];
        break;
      }
    }
  }

  // seçilen saat pencerenin ucunda kırpılmış olabilir (örn. pencere 09:00'da başlıyorsa 09:00-09:59 değil 09:00-09:59 kesişimi)
  const hourStart = Math.max(startMin, hour * 60);
  const hourEnd = Math.min(endMin, hour * 60 + 59);
  const minuteSpan = Math.max(0, hourEnd - hourStart);
  return hourStart + Math.floor(rng() * (minuteSpan + 1));
}

/**
 * `generateRandomTimes`'ın ağırlıklı varyantı (W3.2 — akıllı zamanlama).
 * Aday üretiminde `SMART_TIMING_MIX` oranında `weights`e göre saat ağırlıklı,
 * kalanında tamamen uniform (mevcut davranışla aynı) seçim yapılır. MIN_GAP
 * ve pencere kısıtları, `generateRandomTimes`'daki aynı daralma/tamamlama
 * zinciriyle korunur (asla sonsuz döngüye girmez, asla pencere dışına taşmaz).
 * `weights` `null`/`undefined` ise tamamen `generateRandomTimes` davranışına düşer.
 */
export function generateWeightedTimes(
  startMin: number,
  endMin: number,
  count: number,
  minGap = 90,
  weights?: Record<number, number> | null,
  rng: Rng = defaultRng
): number[] {
  if (!weights) return generateRandomTimes(startMin, endMin, count, minGap, rng);

  const span = endMin - startMin;
  if (span <= 0 || count <= 0) return [];

  let gap = Math.min(minGap, count > 1 ? Math.floor(span / (count - 1)) : span);
  if (gap < 0) gap = 0;

  const nextCandidate = (): number =>
    rng() < SMART_TIMING_MIX
      ? pickWeightedMinute(startMin, endMin, weights, rng)
      : startMin + Math.floor(rng() * (span + 1));

  const times: number[] = [];
  let attempts = 0;
  const maxAttempts = count * 200;

  while (times.length < count && attempts < maxAttempts) {
    attempts++;
    const candidate = nextCandidate();
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
    const candidate = nextCandidate();
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
