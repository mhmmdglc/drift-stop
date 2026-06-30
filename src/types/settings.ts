import type { LanguageCode } from '@/i18n';
import type { QuoteTag } from '@/types/quote';

export type ThemeMode = 'dark' | 'light' | 'system';

export const FREQUENCY_OPTIONS = [3, 5, 7, 10] as const;
export type Frequency = (typeof FREQUENCY_OPTIONS)[number];

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
