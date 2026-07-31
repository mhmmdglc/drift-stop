import { supabase } from '@/lib/supabase';
import { TRIAL_DAYS } from '@/services/trial';
import { setJSON, StorageKeys } from '@/utils/storage';

/**
 * Cihazdaki denemeyi Supabase ile uzlaştırır (bkz. migration 0007).
 *
 * Neden gerekiyor: premium sözlerin İNDİRİLMESİNİ RLS engelliyor ve deneme
 * tamamen yerel olduğu için sunucu onu bilmiyordu — deneme kullanıcısı paketleri
 * açık görüp içini boş buluyordu. `trials` satırı, RLS'in premium okuma
 * politikasındaki ikinci dalı besleyen tek şey.
 *
 * **Sunucudaki satır otoriterdir.** Varsa cihaz ona uyar, kendi damgasını
 * dayatmaz. Sebebi istismar: aksi halde kullanıcı uygulamayı silip yeniden kurup
 * (yeni yerel damga) aynı hesapla girerek denemeyi süresiz uzatırdı. Tabloda
 * UPDATE hakkı da yok (bkz. 0007) — yani satır bir kez yazılır.
 *
 * Bu, "istismar koruması yazılmayacak" kararıyla (spec §0) çelişmiyor: o karar
 * MİSAFİR kullanıcı için, yeniden kurulumla sıfırlanabilir olması kabul edildi.
 * Oturum açan kullanıcıda kimlik zaten elimizde olduğu için bedava gelen bu
 * korumayı bırakmanın bir gerekçesi yok.
 *
 * Hata yutulur: bu bir açılış/oturum yolu işi, ağ yoksa deneme yerelde
 * çalışmaya devam eder ve bir sonraki girişte tekrar denenir.
 */
export async function reconcileTrialWithServer(
  userId: string,
  localStartedAt: number
): Promise<{ startedAt: number; source: 'server' | 'device' | 'unavailable' }> {
  if (!supabase) return { startedAt: localStartedAt, source: 'unavailable' };

  try {
    const { data: existing, error: readError } = await supabase
      .from('trials')
      .select('started_at')
      .maybeSingle();
    if (readError) throw readError;

    if (existing?.started_at) {
      const serverStartedAt = new Date(existing.started_at as string).getTime();
      if (!Number.isFinite(serverStartedAt)) return { startedAt: localStartedAt, source: 'unavailable' };
      // Cihazı sunucuya hizala. Sunucudaki tarih daha ESKİ olabilir (başka cihazda
      // başlamış) ya da daha YENİ olabilir (bu cihaz eski bir yedekten gelmiş);
      // her iki durumda da otorite sunucu.
      if (serverStartedAt !== localStartedAt) {
        await setJSON(StorageKeys.trialStartedAt, serverStartedAt);
      }
      return { startedAt: serverStartedAt, source: 'server' };
    }

    // Henüz satır yok → cihazdaki damgayı kaydet. `ends_at` istemciden geliyor ama
    // politika onu `started_at + 7 gün`e sabitliyor, yani uydurulamıyor.
    const endsAt = localStartedAt + TRIAL_DAYS * 86_400_000;
    const { error: insertError } = await supabase.from('trials').insert({
      user_id: userId,
      started_at: new Date(localStartedAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
    });
    // Yarış durumu (iki cihaz aynı anda) → primary key çakışması. Bu bir hata
    // değil: satır var demektir, bir sonraki uzlaştırma onu okur.
    if (insertError && insertError.code !== '23505') throw insertError;

    return { startedAt: localStartedAt, source: 'device' };
  } catch {
    return { startedAt: localStartedAt, source: 'unavailable' };
  }
}
