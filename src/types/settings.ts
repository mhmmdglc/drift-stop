import type { LanguageCode } from '@/i18n';
import type { QuoteTag } from '@/types/quote';

export type ThemeMode = 'dark' | 'light' | 'system';

export const FREQUENCY_OPTIONS = [3, 5, 7, 10] as const;
export type Frequency = (typeof FREQUENCY_OPTIONS)[number];

/**
 * Ücretsiz kullanıcı için günlük bildirim üst sınırı — 7 ve 10 Pro'ya özel.
 * (Satın almalar bu platformda yapılandırılmamışsa gate uygulanmaz; bkz.
 * useEnforceFreeLimits ve settings ekranındaki lockedValues.)
 */
export const FREE_FREQUENCY_MAX: Frequency = 5;

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
  frequency: 5,
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
