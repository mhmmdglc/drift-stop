/// <reference types="jest" />
jest.mock('@/utils/scheduler', () => ({
  applySchedule: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'fr' }],
}));

import { renderHook, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SettingsProvider, useSettings } from '../useSettings';
import { applySchedule } from '@/utils/scheduler';
import { StorageKeys } from '@/utils/storage';

const mockApplySchedule = applySchedule as jest.Mock;

beforeEach(async () => {
  await AsyncStorage.clear();
  mockApplySchedule.mockClear();
});

describe('useSettings', () => {
  it('falls back to device locale on first launch when it is supported', async () => {
    const { result } = await renderHook(() => useSettings(), { wrapper: SettingsProvider });

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.settings.language).toBe('fr');
  });

  it('persists updates to AsyncStorage', async () => {
    const { result } = await renderHook(() => useSettings(), { wrapper: SettingsProvider });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    // 'light' is deliberately not the default ('dark'), so a no-op bug can't pass silently.
    await act(async () => {
      result.current.setThemeMode('light');
    });

    const stored = await AsyncStorage.getItem(StorageKeys.settings);
    expect(stored).toContain('"themeMode":"light"');
  });

  it('reschedules notifications only when a schedule-affecting field changes', async () => {
    const { result } = await renderHook(() => useSettings(), { wrapper: SettingsProvider });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    mockApplySchedule.mockClear();

    // themeMode is purely cosmetic — must NOT trigger a reschedule.
    await act(async () => {
      result.current.setThemeMode('light');
    });
    expect(mockApplySchedule).not.toHaveBeenCalled();

    // frequency changes how many notifications fire per day — must reschedule.
    await act(async () => {
      result.current.update({ frequency: 10 });
    });
    expect(mockApplySchedule).toHaveBeenCalledTimes(1);
  });

  it('fills goal as null when the stored settings predate the field (no migration needed)', async () => {
    // Eski sürümden kalan diskteki obje `goal` alanını hiç bilmiyor; merge
    // (`{...DEFAULT_SETTINGS, ...stored}`) varsayımı her yeni alanda testle kanıtlanır.
    await AsyncStorage.setItem(
      StorageKeys.settings,
      JSON.stringify({ language: 'en', frequency: 10, themeMode: 'light' })
    );

    const { result } = await renderHook(() => useSettings(), { wrapper: SettingsProvider });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.settings.goal).toBeNull();
    // Eski alanlar da kaybolmamalı — merge tek yönlü ezmemeli.
    expect(result.current.settings.frequency).toBe(10);
  });

  it('throws a clear error when used outside SettingsProvider', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useSettings())).rejects.toThrow(
      'useSettings, SettingsProvider içinde kullanılmalı.'
    );
    consoleErrorSpy.mockRestore();
  });
});
