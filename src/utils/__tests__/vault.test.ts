/// <reference types="jest" />
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  VAULT_FREE_ACTIVE_LIMIT,
  VAULT_SLEEP_DAYS,
  VAULT_TEXT_MAX_LENGTH,
  VAULT_TEXT_MIN_LENGTH,
  activeMessageCount,
  addMessage,
  countActiveMessages,
  deleteMessage,
  eligibleMessages,
  isEligible,
  listMessages,
  markDelivered,
  rearmMessage,
  selectEligibleMessages,
  validateMessageText,
  type VaultMessage,
} from '../vault';

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await AsyncStorage.clear();
});

function mkMessage(overrides: Partial<VaultMessage> = {}): VaultMessage {
  return {
    id: 1,
    text: 'sigara',
    createdAt: 0,
    deliveredAt: null,
    rearmedAt: null,
    ...overrides,
  };
}

describe('validateMessageText (saf fonksiyon)', () => {
  it('trim eder', () => {
    expect(validateMessageText('  sigara  ')).toBe('sigara');
  });

  it('4 karakterden kısaysa null', () => {
    expect(validateMessageText('abc')).toBeNull();
    expect(validateMessageText('   ')).toBeNull();
  });

  it(`${VAULT_TEXT_MAX_LENGTH} karakterden uzunsa null`, () => {
    expect(validateMessageText('a'.repeat(VAULT_TEXT_MAX_LENGTH))).not.toBeNull();
    expect(validateMessageText('a'.repeat(VAULT_TEXT_MAX_LENGTH + 1))).toBeNull();
  });

  it(`tam sınır (${VAULT_TEXT_MIN_LENGTH}) geçerli`, () => {
    expect(validateMessageText('a'.repeat(VAULT_TEXT_MIN_LENGTH))).toBe(
      'a'.repeat(VAULT_TEXT_MIN_LENGTH)
    );
  });
});

describe('isEligible / selectEligibleMessages (saf fonksiyon)', () => {
  const now = 100 * DAY_MS;

  it('teslim edilmişse asla uygun değil', () => {
    const m = mkMessage({ createdAt: 0, deliveredAt: 1 });
    expect(isEligible(m, now)).toBe(false);
  });

  it(`${VAULT_SLEEP_DAYS} günden az beklediyse uygun değil`, () => {
    const m = mkMessage({ createdAt: now - (VAULT_SLEEP_DAYS - 1) * DAY_MS });
    expect(isEligible(m, now)).toBe(false);
  });

  it(`tam ${VAULT_SLEEP_DAYS} gün beklediyse uygun`, () => {
    const m = mkMessage({ createdAt: now - VAULT_SLEEP_DAYS * DAY_MS });
    expect(isEligible(m, now)).toBe(true);
  });

  it('rearm edilmişse yaş rearmedAt\'ten sayılır, createdAt\'ten değil', () => {
    // 30 gün önce yazıldı ama 2 gün önce rearm edildi — hâlâ uykuda olmalı.
    const m = mkMessage({ createdAt: now - 30 * DAY_MS, rearmedAt: now - 2 * DAY_MS });
    expect(isEligible(m, now)).toBe(false);
  });

  it('en uzun bekleyen önce sıralanır', () => {
    const oldest = mkMessage({ id: 1, createdAt: now - 20 * DAY_MS });
    const newest = mkMessage({ id: 2, createdAt: now - VAULT_SLEEP_DAYS * DAY_MS });
    const notEligible = mkMessage({ id: 3, createdAt: now - 1 * DAY_MS });
    const result = selectEligibleMessages([newest, oldest, notEligible], now);
    expect(result.map((m) => m.id)).toEqual([1, 2]);
  });
});

describe('countActiveMessages (saf fonksiyon)', () => {
  it('yalnızca teslim edilmemişleri sayar', () => {
    const messages = [
      mkMessage({ id: 1, deliveredAt: null }),
      mkMessage({ id: 2, deliveredAt: 5 }),
      mkMessage({ id: 3, deliveredAt: null }),
    ];
    expect(countActiveMessages(messages)).toBe(2);
  });

  it('boş listede 0', () => {
    expect(countActiveMessages([])).toBe(0);
  });
});

describe('addMessage', () => {
  it('geçerli metni ekler ve artan id atar', async () => {
    const a = await addMessage('sigara');
    const b = await addMessage('tezim');
    expect(a?.id).toBe(1);
    expect(b?.id).toBe(2);
    expect((await listMessages()).map((m) => m.text)).toEqual(['sigara', 'tezim']);
  });

  it('geçersiz metinde null döner, HİÇBİR ŞEY YAZILMAZ', async () => {
    const result = await addMessage('ab');
    expect(result).toBeNull();
    expect(await listMessages()).toEqual([]);
  });

  it('yeni mesaj deliveredAt/rearmedAt null olarak başlar', async () => {
    const m = await addMessage('sigara');
    expect(m?.deliveredAt).toBeNull();
    expect(m?.rearmedAt).toBeNull();
  });
});

describe('deleteMessage', () => {
  it('id eşleşirse siler', async () => {
    await addMessage('sigara');
    const m2 = await addMessage('tezim');
    await deleteMessage(m2!.id);
    expect((await listMessages()).map((m) => m.text)).toEqual(['sigara']);
  });

  it('olmayan id no-op', async () => {
    await addMessage('sigara');
    await deleteMessage(999);
    expect(await listMessages()).toHaveLength(1);
  });
});

describe('markDelivered', () => {
  it('deliveredAt\'i ayarlar', async () => {
    const m = await addMessage('sigara');
    await markDelivered(m!.id, 12345);
    const stored = await listMessages();
    expect(stored[0].deliveredAt).toBe(12345);
  });

  it('İDEMPOTENT: zaten teslim edilmişse ikinci çağrı zamanı DEĞİŞTİRMEZ', async () => {
    const m = await addMessage('sigara');
    await markDelivered(m!.id, 100);
    await markDelivered(m!.id, 999); // farklı bir "at" ile ikinci çağrı
    const stored = await listMessages();
    expect(stored[0].deliveredAt).toBe(100); // ilk teslim anı korunur
  });
});

describe('rearmMessage', () => {
  it('deliveredAt\'i null\'a döndürür, rearmedAt\'i ayarlar', async () => {
    const m = await addMessage('sigara');
    await markDelivered(m!.id, 100);
    await rearmMessage(m!.id);
    const stored = await listMessages();
    expect(stored[0].deliveredAt).toBeNull();
    expect(typeof stored[0].rearmedAt).toBe('number');
  });
});

describe('activeMessageCount / eligibleMessages (I/O sarmalayıcılar)', () => {
  it('activeMessageCount diskteki teslim edilmemiş sayısını okur', async () => {
    const a = await addMessage('sigara');
    await addMessage('tezim');
    await markDelivered(a!.id, 100);
    expect(await activeMessageCount()).toBe(1);
  });

  it(`free limit sabiti ${VAULT_FREE_ACTIVE_LIMIT}`, () => {
    expect(VAULT_FREE_ACTIVE_LIMIT).toBe(1);
  });

  it('eligibleMessages gerçek storage üzerinden doğru filtreler', async () => {
    await addMessage('yeni'); // az önce yazıldı, uygun değil
    const eligible = await eligibleMessages(Date.now());
    expect(eligible).toEqual([]);
  });
});
