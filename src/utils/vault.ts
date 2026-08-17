import { getJSON, setJSON, StorageKeys } from '@/utils/storage';

/**
 * Geleceğe mesaj kasası (W2.1). Sözlerden FARKLI bir varlık — kullanıcının
 * kendi cümlesi, kendi route'unda açılır, `seenHistory`ye asla girmez
 * (`engagement-roadmap.md` W2.1 kararı). `id` artan yerel bir sayaç
 * (`Date.now()` DEĞİL) — söz id'leriyle çakışma alanı zaten yok çünkü kasa
 * hiçbir söz yüzeyinden (Home/geçmiş/widget) geçmiyor, ama okunur bir kimlik
 * cihaz-QA'da/log'da işi kolaylaştırıyor.
 */
export type VaultMessage = {
  id: number;
  text: string;
  createdAt: number;
  /** Teslim edilmediyse null. Teslim edilince epoch ms. */
  deliveredAt: number | null;
  /** "Yeniden kur" ile en son ne zaman uykuya döndürüldü — null = hiç rearm edilmedi. */
  rearmedAt: number | null;
};

export const VAULT_TEXT_MIN_LENGTH = 4;
export const VAULT_TEXT_MAX_LENGTH = 280;
/** Yazıldıktan/yeniden kurulduktan sonra en az bu kadar gün uyur (roadmap W2.1). */
export const VAULT_SLEEP_DAYS = 7;
/** Free kullanıcı en fazla bu kadar AKTİF (henüz teslim edilmemiş) mesaj tutabilir. */
export const VAULT_FREE_ACTIVE_LIMIT = 1;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Metni doğrular/normalize eder: trim + 4-280 karakter. Geçersizse `null` —
 * tek doğruluk noktası burası (editördeki `maxLength`/disabled durumu UI
 * kolaylığı, gerçek kural burada uygulanır — yapıştırma gibi uç durumlara
 * `GoalSection`/`normalizeGoal` ile aynı gerekçeyle güvenilmez).
 */
export function validateMessageText(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length < VAULT_TEXT_MIN_LENGTH || trimmed.length > VAULT_TEXT_MAX_LENGTH) {
    return null;
  }
  return trimmed;
}

/** Bir mesajın "uykuya girdiği" an — rearm edildiyse ondan, yoksa yazıldığı andan sayılır. */
function sleepStart(message: VaultMessage): number {
  return message.rearmedAt ?? message.createdAt;
}

/**
 * `now` anında teslime uygun mu: henüz teslim edilmemiş VE en az
 * `VAULT_SLEEP_DAYS` geçmiş. Saf — scheduler ve testler doğrudan kullanır.
 */
export function isEligible(message: VaultMessage, now: number): boolean {
  if (message.deliveredAt !== null) return false;
  return now - sleepStart(message) >= VAULT_SLEEP_DAYS * DAY_MS;
}

/**
 * Teslime uygun mesajlar, EN UZUN BEKLEYEN önce (deterministik sıra) —
 * scheduler bu sırayla bir kuyruk kurup her gün baştan tüketir, testler de
 * aynı sırayı doğrular.
 */
export function selectEligibleMessages(messages: VaultMessage[], now: number): VaultMessage[] {
  return messages.filter((m) => isEligible(m, now)).sort((a, b) => sleepStart(a) - sleepStart(b));
}

/** Henüz teslim edilmemiş (deliveredAt null) mesaj sayısı — free limit kontrolü için. */
export function countActiveMessages(messages: VaultMessage[]): number {
  return messages.reduce((count, m) => (m.deliveredAt === null ? count + 1 : count), 0);
}

function nextId(messages: VaultMessage[]): number {
  return messages.reduce((max, m) => Math.max(max, m.id), 0) + 1;
}

/** Tüm kasa mesajlarını okur (sırası: yazılma sırası, en yeni sonda). */
export async function listMessages(): Promise<VaultMessage[]> {
  return getJSON<VaultMessage[]>(StorageKeys.vaultMessages, []);
}

/** Aktif (teslim bekleyen) mesaj sayısı — free-limit kapısı bunu okur. */
export async function activeMessageCount(): Promise<number> {
  return countActiveMessages(await listMessages());
}

/** `now` (varsayılan gerçek an) itibarıyla teslime uygun mesajlar. */
export async function eligibleMessages(now: number = Date.now()): Promise<VaultMessage[]> {
  return selectEligibleMessages(await listMessages(), now);
}

/**
 * Yeni bir kasa mesajı ekler. Metin geçersizse (4-280 karakter dışı) `null`
 * döner ve HİÇBİR ŞEY YAZILMAZ — çağıran (editör) zaten `disabled` butonla
 * bu durumu engelliyor, burası son savunma hattı.
 */
export async function addMessage(text: string): Promise<VaultMessage | null> {
  const trimmed = validateMessageText(text);
  if (trimmed === null) return null;
  const messages = await listMessages();
  const message: VaultMessage = {
    id: nextId(messages),
    text: trimmed,
    createdAt: Date.now(),
    deliveredAt: null,
    rearmedAt: null,
  };
  await setJSON(StorageKeys.vaultMessages, [...messages, message]);
  return message;
}

/** Bir mesajı kalıcı olarak siler (uykuda ya da teslim edilmiş fark etmez). */
export async function deleteMessage(id: number): Promise<void> {
  const messages = await listMessages();
  const next = messages.filter((m) => m.id !== id);
  if (next.length !== messages.length) await setJSON(StorageKeys.vaultMessages, next);
}

/**
 * Teslim edilmiş bir mesajı tekrar uykuya döndürür (yeni `VAULT_SLEEP_DAYS`
 * günlük bekleme, `rearmedAt`ten sayılır). Uykuda olmayan bir mesaja
 * çağrılırsa da (id yoksa) no-op — çağıran taraf zaten yalnızca teslim
 * edilmiş bir mesajın ekranından çağırır.
 */
export async function rearmMessage(id: number): Promise<void> {
  const messages = await listMessages();
  const next = messages.map((m) =>
    m.id === id ? { ...m, deliveredAt: null, rearmedAt: Date.now() } : m
  );
  await setJSON(StorageKeys.vaultMessages, next);
}

/**
 * Teslim edildi olarak işaretler — İDEMPOTENT: mesaj zaten teslim edilmişse
 * (`deliveredAt` dolu) DOKUNMAZ. Aynı mesajın teslimi birden fazla yoldan
 * (bildirime dokunma + arka plan senkronu, `syncDeliveredVaultMessages`)
 * tetiklenebilir — ilk teslim anı gerçek teslim anıdır, ikinci çağrı onu
 * ileri kaydırmamalı (`markDelivered`'ın çağrıldığı her iki yer de bunu
 * bilmeden aynı fonksiyonu güvenle çağırabilsin diye).
 */
export async function markDelivered(id: number, at: number): Promise<void> {
  const messages = await listMessages();
  let changed = false;
  const next = messages.map((m) => {
    if (m.id === id && m.deliveredAt === null) {
      changed = true;
      return { ...m, deliveredAt: at };
    }
    return m;
  });
  if (changed) await setJSON(StorageKeys.vaultMessages, next);
}
