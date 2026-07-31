/// <reference types="jest" />
const mockMaybeSingle = jest.fn();
const mockInsert = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ maybeSingle: mockMaybeSingle }),
      insert: mockInsert,
    }),
  },
}));
jest.mock('@/utils/storage', () => ({
  StorageKeys: { trialStartedAt: 'driftstop:trialStartedAt' },
  setJSON: jest.fn(),
}));

import { reconcileTrialWithServer } from '../trialSync';
import { TRIAL_DAYS } from '../trial';
import { setJSON } from '@/utils/storage';

const mockSetJSON = setJSON as jest.Mock;
const LOCAL = Date.UTC(2026, 6, 20, 9, 0, 0);

beforeEach(() => {
  jest.clearAllMocks();
  mockInsert.mockResolvedValue({ error: null });
});

describe('reconcileTrialWithServer', () => {
  it('sunucuda satır yoksa cihazdaki damgayı yazar, ends_at = başlangıç + 7 gün', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await reconcileTrialWithServer('user-1', LOCAL);

    expect(result).toEqual({ startedAt: LOCAL, source: 'device' });
    const row = mockInsert.mock.calls[0][0];
    expect(row.user_id).toBe('user-1');
    expect(new Date(row.started_at).getTime()).toBe(LOCAL);
    // Politika bu eşitliği CHECK ile zorluyor (migration 0007); istemci de tutmalı,
    // yoksa insert sessizce reddedilir ve deneme sunucuda hiç var olmaz.
    expect(new Date(row.ends_at).getTime() - new Date(row.started_at).getTime()).toBe(
      TRIAL_DAYS * 86_400_000
    );
  });

  it('sunucudaki satır otoriter — DAHA ESKİ tarihi benimser (yeniden kurulumla uzatma engeli)', async () => {
    const serverStart = LOCAL - 5 * 86_400_000;
    mockMaybeSingle.mockResolvedValue({
      data: { started_at: new Date(serverStart).toISOString() },
      error: null,
    });

    const result = await reconcileTrialWithServer('user-1', LOCAL);

    expect(result).toEqual({ startedAt: serverStart, source: 'server' });
    expect(mockSetJSON).toHaveBeenCalledWith('driftstop:trialStartedAt', serverStart);
    // Satır varken insert DENENMEZ: tabloda UPDATE hakkı yok, ikinci insert de
    // primary key'e çarpar.
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('sunucudaki tarih daha YENİ olsa da benimser (cihaz eski bir yedekten gelmiş olabilir)', async () => {
    const serverStart = LOCAL + 3 * 86_400_000;
    mockMaybeSingle.mockResolvedValue({
      data: { started_at: new Date(serverStart).toISOString() },
      error: null,
    });

    const result = await reconcileTrialWithServer('user-1', LOCAL);

    expect(result.startedAt).toBe(serverStart);
    expect(result.source).toBe('server');
  });

  it('aynı tarihse diske gereksiz yazmaz', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { started_at: new Date(LOCAL).toISOString() },
      error: null,
    });

    await reconcileTrialWithServer('user-1', LOCAL);

    expect(mockSetJSON).not.toHaveBeenCalled();
  });

  it('yarışta oluşan primary key çakışmasını hata saymaz', async () => {
    // İki cihaz aynı anda giriş yaptı. Satır var demek; bir sonraki uzlaştırma okur.
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } });

    const result = await reconcileTrialWithServer('user-1', LOCAL);

    expect(result).toEqual({ startedAt: LOCAL, source: 'device' });
  });

  it('okuma patlarsa cihazdaki damgayı DEĞİŞTİRMEZ', async () => {
    // Ağ yoksa deneme yerelde çalışmaya devam etmeli; buradan yanlış bir tarih
    // yazmak kullanıcının denemesini kısaltır ya da uzatır.
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'network' } });

    const result = await reconcileTrialWithServer('user-1', LOCAL);

    expect(result).toEqual({ startedAt: LOCAL, source: 'unavailable' });
    expect(mockSetJSON).not.toHaveBeenCalled();
  });

  it('bozuk tarih gelirse cihazdaki damgada kalır', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { started_at: 'not-a-date' }, error: null });

    const result = await reconcileTrialWithServer('user-1', LOCAL);

    expect(result).toEqual({ startedAt: LOCAL, source: 'unavailable' });
    expect(mockSetJSON).not.toHaveBeenCalled();
  });
});
