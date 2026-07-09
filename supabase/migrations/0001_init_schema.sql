-- DriftStop — Faz 0: temel şema
-- Bkz. BACKEND-PREMIUM-YOL-HARITASI.md
--
-- Tablolar: profiles, quotes, quote_packs, favorites, reflections, user_settings
-- İlke: entitlement (is_premium) İSTEMCİDE asla karar verilmez; sadece bu tablodaki
-- alana bakılır, o alanı da sadece RevenueCat webhook'u (Faz 3) yazar.

-- ── profiles ────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_premium boolean not null default false,
  premium_since timestamptz,
  streak_count int not null default 0,
  streak_last_date date,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- Yeni kullanıcı auth.users'a düşünce otomatik profiles satırı oluştur.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── quote_packs (premium küratörlü koleksiyonlar) ───────────────────────────
create table if not exists quote_packs (
  id text primary key,
  name jsonb not null,          -- {"tr": "...", "en": "..."}
  description jsonb,
  cover_image_url text,
  is_premium boolean not null default true,
  sort_order int not null default 0
);

alter table quote_packs enable row level security;

drop policy if exists "quote_packs_public_read" on quote_packs;
create policy "quote_packs_public_read" on quote_packs for select
  using (true);  -- paket adı/kapağı herkese görünür; içerik quotes tablosunda korunur

-- ── quotes (sözlerin gerçek kaynağı — quotes.json'un yerini alır) ───────────
create table if not exists quotes (
  id bigint primary key,
  text text not null,
  text_tr text,
  author text,
  origin text,
  era text,
  tags text[] not null default '{}',
  pack_id text references quote_packs(id),
  is_premium boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists idx_quotes_pack_id on quotes(pack_id);
create index if not exists idx_quotes_is_premium on quotes(is_premium);
create index if not exists idx_quotes_updated_at on quotes(updated_at);

alter table quotes enable row level security;

drop policy if exists "quotes_public_read_free" on quotes;
create policy "quotes_public_read_free" on quotes for select
  using (is_premium = false);

drop policy if exists "quotes_premium_read_entitled" on quotes;
create policy "quotes_premium_read_entitled" on quotes for select
  using (
    is_premium = true
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.is_premium = true
    )
  );

-- ── favorites ────────────────────────────────────────────────────────────
create table if not exists favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  quote_id bigint not null references quotes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, quote_id)
);

create index if not exists idx_favorites_quote_id on favorites(quote_id);

alter table favorites enable row level security;

drop policy if exists "favorites_own_rows" on favorites;
create policy "favorites_own_rows" on favorites for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── reflections (ritüel katmanı — bir söze yazılan kısa not) ────────────────
create table if not exists reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quote_id bigint not null references quotes(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_reflections_user_id on reflections(user_id);

alter table reflections enable row level security;

drop policy if exists "reflections_own_rows" on reflections;
create policy "reflections_own_rows" on reflections for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── user_settings (senkron edilen tercihler — tema/dil/bildirim) ───────────
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text,
  language text,
  notification_prefs jsonb,
  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;

drop policy if exists "user_settings_own_rows" on user_settings;
create policy "user_settings_own_rows" on user_settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
