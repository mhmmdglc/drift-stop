/// <reference types="jest" />
// `@react-native-async-storage/async-storage` gerçek (mock) sürümüyle çalışır —
// `jest.setup.js`teki global mock, useSettings.test.tsx'teki desenle aynı.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { recordReckoningAction } from '../reckoningAction';
import { RECKONING_KIND } from '../scheduler';
import { StorageKeys } from '../storage';
import type { ReckoningLog } from '../reckoning';

beforeEach(async () => {
  await AsyncStorage.clear();
});

async function readLog(): Promise<ReckoningLog> {
  const raw = await AsyncStorage.getItem(StorageKeys.reckoningLog);
  return raw ? (JSON.parse(raw) as ReckoningLog) : {};
}

describe('recordReckoningAction', () => {
  it('resisted cevabını tarihe yazar', async () => {
    await recordReckoningAction('resisted', { kind: RECKONING_KIND, date: '2026-08-19' });
    expect(await readLog()).toEqual({ '2026-08-19': 'resisted' });
  });

  it('drifted cevabını tarihe yazar', async () => {
    await recordReckoningAction('drifted', { kind: RECKONING_KIND, date: '2026-08-19' });
    expect(await readLog()).toEqual({ '2026-08-19': 'drifted' });
  });

  it('aynı güne ikinci cevap ÜZERİNE YAZAR', async () => {
    await recordReckoningAction('resisted', { kind: RECKONING_KIND, date: '2026-08-19' });
    await recordReckoningAction('drifted', { kind: RECKONING_KIND, date: '2026-08-19' });
    expect(await readLog()).toEqual({ '2026-08-19': 'drifted' });
  });

  it('kind reckoning DEĞİLSE no-op (W1.4 söz aksiyonları buraya sızmaz)', async () => {
    await recordReckoningAction('resisted', { kind: 'quote', date: '2026-08-19' });
    expect(await readLog()).toEqual({});
  });

  it('bilinmeyen aksiyon kimliği no-op', async () => {
    await recordReckoningAction('favorite', { kind: RECKONING_KIND, date: '2026-08-19' });
    expect(await readLog()).toEqual({});
  });

  it('data undefined ise no-op', async () => {
    await recordReckoningAction('resisted', undefined);
    expect(await readLog()).toEqual({});
  });

  it('date verilmemişse bugünün dateKey ile yazar', async () => {
    await recordReckoningAction('resisted', { kind: RECKONING_KIND });
    const log = await readLog();
    expect(Object.keys(log)).toHaveLength(1);
    expect(Object.values(log)).toEqual(['resisted']);
  });
});
