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
};

/** Bitiş, başlangıçtan en az bu kadar dakika sonra olmalı (2 saat). */
export const MIN_WINDOW_MINUTES = 120;
