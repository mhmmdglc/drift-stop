-- Kartsız 7 günlük deneme — sunucu tarafı (spec §5, Faz B).
--
-- Neden gerekiyor: deneme cihazda başlıyor (kullanıcıların çoğu misafir) ama premium
-- sözlerin İNDİRİLMESİNİ RLS engelliyor (`quotes_premium_read_entitled` →
-- `profiles.is_premium`) ve `is_premium`'u migration 0004'ten beri yalnızca
-- `revenuecat-webhook` (service_role) yazabiliyor. Denemenin RevenueCat'te bir
-- karşılığı olmadığı için deneme kullanıcısı paketleri AÇIK görüyor ama içi BOŞ
-- çıkıyordu — denemenin ana vaadi teslim edilmiyordu.
--
-- Çözüm: denemeyi `profiles.is_premium`'a YAZMAK yerine ayrı bir tabloda tutup
-- politikaya ikinci bir dal eklemek. `is_premium`'u denemeye de yazan bir sürüm iki
-- şeyi birbirine karıştırırdı: webhook aboneliği kaldırdığında denemeyi de silerdi,
-- ve "gerçekten ödeyen kim" sorusu artık cevaplanamazdı.

create table if not exists trials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Cihazdaki damga. İstemci uzlaştırırken EN ESKİ tarihi yazıyor: kullanıcı ikinci
  -- bir cihaz kurup denemeyi baştan başlatarak uzatamasın.
  started_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_trials_ends_at on trials(ends_at);

alter table trials enable row level security;

-- Kullanıcı yalnızca kendi satırını görür.
drop policy if exists "trials_select_own" on trials;
create policy "trials_select_own" on trials for select
  using (user_id = auth.uid());

/*
 * Kullanıcı kendi denemesini BİR KEZ kurabilir; UPDATE hakkı YOK.
 *
 * Neden update yok: satırı güncelleyebilen bir istemci `ends_at`'i ileri atıp
 * denemeyi süresiz hale getirebilirdi. Tek yazma hakkı insert, ve `ends_at`
 * istemciden gelmiyor — aşağıdaki CHECK, girilen değeri `started_at + 7 gün`e
 * sabitliyor. `started_at`'in gelecekte olması da engelli (cihaz saati ileri
 * alınarak denemenin başlangıcı ertelenemesin).
 */
drop policy if exists "trials_insert_own" on trials;
create policy "trials_insert_own" on trials for insert
  with check (
    user_id = auth.uid()
    and started_at <= now() + interval '1 day'
    and ends_at = started_at + interval '7 days'
  );

-- Premium okuma: abonelik VEYA süresi geçmemiş deneme.
-- Politika birleştirilmiyor, ayrı bir OR dalı olarak yazılıyor ki abonelik yolunun
-- davranışı hiç değişmesin.
drop policy if exists "quotes_premium_read_entitled" on quotes;
create policy "quotes_premium_read_entitled" on quotes for select
  using (
    is_premium = true
    and (
      exists (
        select 1 from profiles
        where profiles.id = auth.uid() and profiles.is_premium = true
      )
      or exists (
        select 1 from trials
        where trials.user_id = auth.uid() and trials.ends_at > now()
      )
    )
  );
