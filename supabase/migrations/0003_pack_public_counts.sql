-- DriftStop — Faz 4 fix: free/guest users saw "0 quotes" on locked packs (the
-- badge was derived from LOCALLY-synced quote rows, which RLS never lets a
-- non-entitled client download) and the "Authors" section was entirely
-- invisible to them (same root cause — derived from synced content). Both are
-- cosmetic/marketing metadata, not the quote text itself, so it's safe to
-- expose them publicly like quote_packs.name/description already are.

alter table quote_packs add column if not exists quote_count integer not null default 0;

-- Bypasses RLS on `quotes` (owned by a superuser role, SECURITY DEFINER) to
-- return only author + count — never the quote text itself.
create or replace function public.get_premium_author_counts()
returns table(author text, quote_count bigint)
language sql
security definer
set search_path = public
as $$
  select author, count(*) as quote_count
  from quotes
  where is_premium = true
  group by author
  order by author;
$$;

grant execute on function public.get_premium_author_counts() to anon, authenticated;
