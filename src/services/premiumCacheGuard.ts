import { getExpectedPremiumQuoteCount } from '@/db/packsCache';
import {
  clearPurgedPremiumQuoteIds,
  countCachedPremiumQuotes,
  getPremiumBackfillCount,
  purgePremiumQuotes,
  setPremiumBackfillCount,
} from '@/db/quotesCache';
import { syncPremiumQuotes } from '@/services/quotesSync';
import { reportError } from '@/utils/crashReporting';

/**
 * Premium içeriğin yerel kopyasını entitlement ile hizalar.
 *
 * Sorun: premium sözler bir kez Supabase'ten SQLite'a indikten sonra hiç
 * silinmiyordu. Abonelik bitse, kullanıcı çıkış yapsa, hesabını silse bile
 * favoriler ve /quote/[id] üzerinden tüm premium metin okunmaya devam ediyordu
 * (gelir kaçağı; ayrıca hesap silme onay metni "premium paket erişimin sona
 * erecek" diyor — bu yerelde doğru DEĞİLDİ).
 *
 * Tasarım kararları:
 * - **Hakkı olmayanda her açılışta temizlik yapılır** (sadece geçişte değil).
 *   Idempotent ve kendi kendini onarır: yarış durumunda (RevenueCat hakkı
 *   düşürdü ama webhook `profiles.is_premium`'u henüz güncellemediği için o an
 *   uçuşta olan bir senkron premium satır yazdı) bir sonraki açılış temizler.
 * - **"Hak yok" ile "henüz bilinmiyor" TİP SEVİYESİNDE ayrıdır**
 *   (`PremiumEntitlementState`). Eskiden imza `entitled: boolean` idi ve
 *   "bilinmiyorsa false geçme" kuralı sadece bir yorumdu; `usePurchases.loading`
 *   `getCustomerInfo()` REDDEDİLDİĞİNDE de kapandığı için o kural sessizce
 *   ihlal edilebiliyordu → ödeme yapan kullanıcının cache'i uçuyordu. Artık
 *   'unknown' temsil edilebilir bir durum ve bu fonksiyon onu görürse hiçbir şey
 *   yapmaz; yani yıkıcı dal, çağıran ne geçerse geçsin, bilgi olmadan çalışamaz.
 * - **"Geri yükleme gerekli mi" sorusu cache'in kendi içeriğinden okunur**
 *   (satır sayısı vs. `packs.quote_count` toplamı), ayrı bir "son tier"
 *   bayrağından değil: bayrak ile gerçek durum ayrışabilir, satır sayısı ayrışamaz.
 * - Paket/yazar META verisi (packsCache: `packs`, `premium_authors`) BİLİNÇLİ
 *   olarak silinmez. Paket adları, söz sayıları ve yazar sayıları herkese açık
 *   veridir (bkz. migration 0003 + `get_premium_author_counts()`); kilitli
 *   paketlerin gerçek sayılarla görünmesi ürün gereği — üstelik "cache eksik mi"
 *   ölçümü de bu sayılara dayanıyor.
 *
 * Sunucu tarafı: premium satırların İNDİRİLMESİNİ RLS engelliyor
 * (`quotes_premium_read_entitled` → `profiles.is_premium`) ve migration 0004'ten
 * beri istemci rolleri `profiles`'a UPDATE yapamıyor — yani `is_premium`'u
 * yalnızca `revenuecat-webhook` (service_role) yazabiliyor. Buradaki temizlik o
 * kapının yerine geçmiyor; daha önce indirilmiş kopyayı topluyor.
 */

/**
 * Entitlement'ın üç durumu. 'unknown' bilinçli olarak temsil edilebilir:
 * `false` ile "bilmiyoruz"u aynı değere sıkıştırmak, bu modülün sebep olabileceği
 * en pahalı hatanın (ödeme yapan kullanıcının cache'ini silmek) kaynağıydı.
 */
export type PremiumEntitlementState =
  /** RevenueCat `customerInfo` alındı ve `pro` aktif. */
  | 'entitled'
  /** RevenueCat `customerInfo` alındı ve `pro` aktif DEĞİL. */
  | 'none'
  /** `customerInfo` hiç gelmedi (ağ/ilk açılış/yapılandırma yok) — karar verilemez. */
  | 'unknown';

export type PremiumCacheAction =
  /** Yapılacak bir şey yoktu (hak yok + silinecek satır yok, ya da hak var + içerik tam). */
  | 'noop'
  /** Entitlement bilinmiyordu — hiçbir şey yapılmadı (özellikle: SİLİNMEDİ). */
  | 'unknown'
  /** Premium satırlar silindi. */
  | 'purged'
  /** Premium içerik yeniden indirildi. */
  | 'restored'
  /** Hak var ama sunucu premium satır vermedi (webhook gecikmesi/ağ) — tekrar denenmeli. */
  | 'restore-pending'
  /** İş uçuştayken çağıran vazgeçti (ör. çıkış yapıldı) — hiçbir satır yazılmadı. */
  | 'cancelled'
  /** SQLite/ağ beklenmedik şekilde patladı — yutuldu, bir sonraki tetikte tekrar denenir. */
  | 'failed';

export type PremiumCacheResult = { action: PremiumCacheAction; purged: number };

/**
 * Yerel premium cache'i "tam" sayabilir miyiz.
 *
 * `count > 0` YETMEZ: 1 satırlık yarım bir cache, 3.325 satırlık tam bir cache'ten
 * ayırt edilemez ve hak sahibi dal `noop` döndüğü için o cache sonsuza kadar eksik
 * kalır. Beklenen sayı, herkese açık paket metadata'sından okunur
 * (`packs.quote_count` toplamı — premium içerik silinse bile durur).
 *
 * `backfill` filigranı metadata sapmasına karşı: sunucu RLS altında gerçekten
 * 3.300 satır veriyorsa (25 söz yayından kaldırılmış ama `quote_count`
 * güncellenmemiş) "3.300 < 3.325" kuralı HER açılışta tam indirme tetiklerdi.
 * Bir kez tam çekim yapıldıktan sonra filigran o sayıyı sabitler ve akış yakınsar.
 */
function isCacheSufficient(cached: number): boolean {
  if (cached === 0) return false;
  const expected = getExpectedPremiumQuoteCount();
  // Paket metadata'sı henüz senkronlanmadı → ölçemiyoruz; eldeki tek bilgi "boş değil".
  if (expected <= 0) return true;
  if (cached >= expected) return true;
  const backfilled = getPremiumBackfillCount();
  return backfilled != null && cached >= backfilled;
}

/**
 * @param entitlement Doğrulanmış entitlement durumu. 'unknown' geçmek güvenlidir:
 *   fonksiyon hiçbir şey yapmaz. Çağıran (`usePremiumCacheGuard`) bunu
 *   `usePurchases().entitlementKnown` üzerinden hesaplar — `!loading` DEĞİL.
 * @param options.isCancelled Uzun süren geri yükleme sırasında (2-5 sn) çağıranın
 *   vazgeçtiğini bildirir; ağdan gelen satırlar yazılmadan ÖNCE kontrol edilir.
 */
export async function reconcilePremiumCache(
  entitlement: PremiumEntitlementState,
  options?: { isCancelled?: () => boolean }
): Promise<PremiumCacheResult> {
  // Yıkıcı akışın tek kapısı: bilgi yoksa hiçbir şey yapılmaz.
  if (entitlement === 'unknown') return { action: 'unknown', purged: 0 };

  // Yıkıcı ve/veya ağ+disk işi; her açılışta çalışıyor, bu yüzden hiçbir hata
  // yukarı sızmamalı. Sızarsa `deleteAccount()` hesap silindikten SONRA reject
  // eder (settings.tsx busy bayrağını hiç temizlemez, satır sonsuza kadar
  // "Loading…"te kalır) ya da her açılışta yakalanmamış bir promise reddi olur.
  // Repodaki tüm cache/sync giriş noktaları gibi yutulur.
  try {
    if (entitlement === 'none') {
      const purged = purgePremiumQuotes();
      if (purged > 0) bumpPremiumCacheVersion();
      return { action: purged > 0 ? 'purged' : 'noop', purged };
    }

    // Hak var: içerik zaten TAM ise dokunma (normal delta senkronu güncel tutar).
    if (isCacheSufficient(countCachedPremiumQuotes())) return { action: 'noop', purged: 0 };

    const { synced, cancelled } = await syncPremiumQuotes({ isCancelled: options?.isCancelled });
    if (cancelled) return { action: 'cancelled', purged: 0 };

    if (synced > 0) {
      // `synced > 0` ⇒ sayfalamanın tamamı başarıyla bitti (hata olsaydı 0 dönerdi),
      // yani bu sayı "sunucunun bu hakla verdiği tam premium küme"nin boyutu.
      setPremiumBackfillCount(synced);
      // Artık gerçek satırlar var; mezar taşları (silinmiş premium id'leri) gereksiz.
      clearPurgedPremiumQuoteIds();
      bumpPremiumCacheVersion();
      return { action: 'restored', purged: 0 };
    }

    // Muhtemel sebep: RevenueCat istemcide hakkı hemen açtı ama RLS'in okuduğu
    // `profiles.is_premium` webhook ile birkaç saniye sonra yazılıyor.
    return { action: 'restore-pending', purged: 0 };
  } catch (e) {
    reportError(e, { scope: 'reconcilePremiumCache', entitlement });
    return { action: 'failed', purged: 0 };
  }
}

/**
 * Oturum kapanışı / hesap silme: entitlement hesaba bağlı olduğu için
 * (webhook `profiles.is_premium`'u kullanıcı id'sine yazar) premium içerik
 * RevenueCat dinleyicisini beklemeden hemen gitmeli.
 *
 * Hata yutulur: bu çağrı `deleteAccount()` içinde, hesap SUNUCUDA silindikten
 * sonra çalışıyor — buradan fırlayan bir disk hatası, kullanıcıya hesabı
 * silinmemiş gibi görünmesine (ve `settings.tsx`'te takılı bir "Loading…"e) yol açardı.
 */
export function purgePremiumCacheForSignOut(): number {
  try {
    const purged = purgePremiumQuotes();
    if (purged > 0) bumpPremiumCacheVersion();
    return purged;
  } catch (e) {
    reportError(e, { scope: 'purgePremiumCacheForSignOut' });
    return 0;
  }
}

/**
 * Premium cache sürümü — ekranlara "cache değişti, yeniden oku" sinyali.
 *
 * Neden gerekiyor: satın alma bitince `isPro` anında true olur ama premium
 * satırlar SQLite'a 2-5 sn sonra düşer. Favoriler/söz detayı yalnızca
 * `[ids, isPro]` bağımlılıklarıyla hesaplarsa, satırlar geldiğinde HİÇBİR ŞEY
 * yeniden hesaplanmaz ve kullanıcı ödeme yaptığı halde kilidi görmeye devam eder
 * (Favoriler mount kalan bir sekme olduğu için sekme değiştirmek de kurtarmaz).
 *
 * `usePacks`'teki `version` sayacı kalıbının aynısı; tek fark, mutasyonu yapan
 * kod (bu modül) ile okuyan ekranlar farklı ağaçlarda olduğu için sayaç modül
 * seviyesinde tutulup abonelikle dağıtılıyor (bkz. `hooks/usePremiumCacheVersion.ts`).
 */
let premiumCacheVersion = 0;
const versionListeners = new Set<() => void>();

function bumpPremiumCacheVersion(): void {
  premiumCacheVersion += 1;
  for (const listener of versionListeners) listener();
}

export function getPremiumCacheVersion(): number {
  return premiumCacheVersion;
}

export function subscribePremiumCacheVersion(listener: () => void): () => void {
  versionListeners.add(listener);
  return () => {
    versionListeners.delete(listener);
  };
}
