import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { getLocales } from 'expo-localization';

import i18n, { AVAILABLE_LANGUAGE_CODES, type LanguageCode } from '@/i18n';
import { DEFAULT_SETTINGS, type Settings, type ThemeMode } from '@/types/settings';

/** İlk açılışta cihaz dilini (destekleniyorsa) seç, yoksa Türkçe. */
function detectLanguage(): LanguageCode {
  const code = getLocales()[0]?.languageCode ?? '';
  return (AVAILABLE_LANGUAGE_CODES as string[]).includes(code)
    ? (code as LanguageCode)
    : 'tr';
}
import { applySchedule } from '@/utils/scheduler';
import { getJSON, setJSON, StorageKeys } from '@/utils/storage';

type SettingsContextValue = {
  settings: Settings;
  loaded: boolean;
  update: (patch: Partial<Settings>) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setLanguage: (lang: LanguageCode) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

const SCHEDULE_KEYS: (keyof Settings)[] = [
  'notificationsEnabled',
  'frequency',
  'startHour',
  'startMinute',
  'endHour',
  'endMinute',
  'disableWeekends',
  'language', // dil değişince bildirim metinleri de değişmeli
  'themes', // tema seçimi değişince bildirim havuzu değişir
];

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    getJSON<Partial<Settings>>(StorageKeys.settings, {}).then((stored) => {
      if (active) {
        const language = stored.language ?? detectLanguage();
        const merged = { ...DEFAULT_SETTINGS, ...stored, language };
        i18n.locale = merged.language;
        setSettings(merged);
        setLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (patch.language) {
        i18n.locale = patch.language; // scheduler yeni dili kullansın diye önce ayarla
      }
      void setJSON(StorageKeys.settings, next);
      const affectsSchedule = Object.keys(patch).some((k) =>
        SCHEDULE_KEYS.includes(k as keyof Settings)
      );
      if (affectsSchedule) {
        void applySchedule(next);
      }
      return next;
    });
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => update({ themeMode: mode }), [update]);
  const setLanguage = useCallback((lang: LanguageCode) => update({ language: lang }), [update]);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, loaded, update, setThemeMode, setLanguage }),
    [settings, loaded, update, setThemeMode, setLanguage]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings, SettingsProvider içinde kullanılmalı.');
  return ctx;
}
