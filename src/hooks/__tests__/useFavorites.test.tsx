/// <reference types="jest" />
// `persist()`'in fire-and-forget diske yazımı ile `AppState → active`
// dinleyicisinin okuması arasındaki yarışı hedefler (code review, 2026-08-16):
// dinleyici artık `pendingWrite`i bekliyor, bu yüzden devam eden bir silme
// işlemi bir arka-plan geçişiyle geri getirilemez. Gerçek zamanlanmış
// (async-gated) bir mock yerine çağrı SIRASINI doğrudan kanıtlıyoruz —
// çözülmeyen bir promise'i `act()` içinde beklemek OOM'a yol açtı (denendi).
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useFavorites } from '../useFavorites';
import { getJSON, setJSON } from '@/utils/storage';

jest.mock('@/utils/storage', () => {
  const actual = jest.requireActual('@/utils/storage');
  return {
    StorageKeys: actual.StorageKeys,
    getJSON: jest.fn(),
    setJSON: jest.fn(),
  };
});

const mockGetJSON = getJSON as jest.Mock;
const mockSetJSON = setJSON as jest.Mock;

function fireAppStateActive() {
  const listener = (AppState.addEventListener as jest.Mock).mock.calls.find(
    (c) => c[0] === 'change'
  )?.[1] as ((state: string) => void) | undefined;
  listener?.('active');
}

beforeEach(() => {
  mockGetJSON.mockReset();
  mockSetJSON.mockReset();
});

describe('useFavorites — AppState yarışı', () => {
  it('AppState okuması, devam eden yazımdan ÖNCE değil SONRA olacak şekilde sıralanır', async () => {
    mockGetJSON.mockResolvedValueOnce([1, 2, 3]); // ilk mount okuması
    const { result } = await renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.ids).toEqual([1, 2, 3]);

    // Yazımı çözülmemiş bir promise'e bağlayıp SIRAYI izliyoruz — hiçbir
    // yerde bu promise'i `act()` içinde beklemiyoruz (OOM riski oradaydı).
    const calls: string[] = [];
    let releaseWrite: (() => void) | undefined;
    mockSetJSON.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseWrite = () => {
            calls.push('write-settled');
            resolve();
          };
        })
    );
    mockGetJSON.mockImplementationOnce(async () => {
      calls.push('appstate-read');
      return [1, 2, 3]; // dinleyici beklemeden okusaydı diskteki ESKİ hâli görürdü
    });

    // `act()`in kendisi awaitlenmeli (bu ortamın kuralı — proje çapında
    // aynı desen), ama callback'in İÇİ senkron kalıyor: çözülmeyen
    // `pendingWrite` promise'i callback'in parçası değil, `persist()`
    // onu beklemeden ateşliyor.
    await act(() => {
      result.current.remove(2); // senkron: ids hemen [1,3], setJSON beklemede
    });
    expect(result.current.ids).toEqual([1, 3]);
    expect(mockSetJSON).toHaveBeenCalledTimes(1);

    const getJSONCallsBeforeAppState = mockGetJSON.mock.calls.length; // mount'ta 1 kez çağrılmıştı
    await act(() => {
      fireAppStateActive(); // yazım hâlâ beklerken tetiklenir
    });
    // Kilit çalışıyorsa dinleyicinin okuması henüz BAŞLAMAMIŞ olmalı —
    // `pendingWrite.current`i bekliyor, mount'tan BERİ yeni bir çağrı olmamalı.
    expect(mockGetJSON.mock.calls.length).toBe(getJSONCallsBeforeAppState);

    releaseWrite?.();
    await waitFor(() =>
      expect(mockGetJSON.mock.calls.length).toBe(getJSONCallsBeforeAppState + 1)
    );

    // Sıra kanıtı: yazım okuma SIRASINDAN önce ayarlanmış olmalı.
    expect(calls).toEqual(['write-settled', 'appstate-read']);
  });
});
