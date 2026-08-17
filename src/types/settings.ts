import type { LanguageCode } from '@/i18n';
import type { QuoteTag } from '@/types/quote';

export type ThemeMode = 'dark' | 'light' | 'system';

export const FREQUENCY_OPTIONS = [3, 5, 7, 10] as const;
export type Frequency = (typeof FREQUENCY_OPTIONS)[number];

/**
 * Ücretsiz kullanıcı için günlük bildirim üst sınırı — 5, 7 ve 10 Pro'ya özel.
 * (Satın almalar bu platformda yapılandırılmamışsa gate uygulanmaz; bkz.
 * useEnforceFreeLimits ve settings ekranındaki lockedValues.)
 *
 * Neden 3: eskiden 5'ti ve DEFAULT_SETTINGS.frequency de 5'ti — yani kullanıcı
 * ücretsiz paketin tam tavanında başlıyor, hiçbir zaman sınıra çarpmıyordu.
 * Kıtlık hissi oluşmayınca Pro'nun bir cevabı olduğu soru da oluşmuyordu.
 * 3'ün altına inilmedi: ürünün vaadi "beklenmedik anda gelen hatırlatma" ve
 * günde iki bildirim bu vaadi taşımıyor.
 */
export const FREE_FREQUENCY_MAX: Frequency = 3;

/**
 * Hedef metninin üst sınırı — bildirim başlığı şablonlarına (%{goal}) giriyor;
 * 32 karakter + en uzun şablon eki Android'de tek satırda kalıyor.
 */
export const GOAL_MAX_LENGTH = 32;

/**
 * Serbest hedef girdisini tek noktadan normalize eder: trim + üst sınır, boşsa null.
 * `maxLength` platformca uygulanıyor ama tek doğruluk noktası kayıt anıdır
 * (yapıştırma/IME uç durumlarına güvenilmez).
 */
export function normalizeGoal(text: string): string | null {
  return text.trim().slice(0, GOAL_MAX_LENGTH) || null;
}

export type Settings = {
  notificationsEnabled: boolean;
  frequency: Frequency;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  disableWeekends: boolean;
  themeMode: ThemeMode;
  language: LanguageCode;
  /** Seçili tema tag'leri. Boş = hepsi (filtre yok). */
  themes: QuoteTag[];
  /** Kullanıcının bırakmaya çalıştığı şey ("sigara" vb.). null = kişiselleştirme yok. */
  goal: string | null;
  /** Gece hesaplaşması bildirimi + Home şeridi açık mı. Kapatınca bildirim kurulmaz. */
  reckoningEnabled: boolean;
  /**
   * Akıllı zamanlama (W3.2): açıkken bildirim saatleri `engagementLog`dan çıkan
   * saat ağırlıklarına doğru hafifçe kayar (`SMART_TIMING_MIX`). Kapalıyken ya
   * da yeterli veri yokken (`< MIN_ENGAGEMENT_LOG_FOR_WEIGHTS`) tamamen rastgele
   * üretime düşer — davranış farkı yalnızca üretici fonksiyon seçiminde.
   */
  smartTiming: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  notificationsEnabled: true,
  frequency: 3,
  startHour: 9,
  startMinute: 0,
  endHour: 21,
  endMinute: 0,
  disableWeekends: false,
  themeMode: 'dark',
  language: 'tr',
  themes: [],
  goal: null,
  reckoningEnabled: true,
  smartTiming: true,
};

/** Bitiş, başlangıçtan en az bu kadar dakika sonra olmalı (2 saat). */
export const MIN_WINDOW_MINUTES = 120;
