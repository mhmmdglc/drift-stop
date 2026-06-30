import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { Palettes, type ThemeColors, type ThemeName } from '@/constants/colors';
import { useSettings } from '@/hooks/useSettings';
import type { ThemeMode } from '@/types/settings';

type ThemeContextValue = {
  colors: ThemeColors;
  themeName: ThemeName;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Tema modunu ayarlardan okur (SettingsProvider içinde olmalı). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings, setThemeMode } = useSettings();
  const systemScheme = useColorScheme();
  const mode = settings.themeMode;

  const value = useMemo<ThemeContextValue>(() => {
    const resolved: ThemeName =
      mode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : mode;
    return {
      colors: Palettes[resolved],
      themeName: resolved,
      mode,
      setMode: setThemeMode,
    };
  }, [mode, systemScheme, setThemeMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme, ThemeProvider içinde kullanılmalı.');
  }
  return ctx;
}
