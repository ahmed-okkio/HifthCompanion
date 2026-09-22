-- ---------------------------------------------------------------------------
-- wird + wird_entry — a personal daily recitation portion (PRD 0015, M1).
--
-- User-scoped, not membership-scoped (D1): a wird exists with or without a
-- circle. There is deliberately NO cursor column (D3) — position derives from
-- max(page_end) over the entries of the current cycle_seq — and no partial /
-- amount column on wird_entry (D4). Deleting is a soft delete (D19), so
-- deleted_at is nulled out of every read; the FK cascade below only matters
-- for a hard delete.
--
-- RLS mirrors user_hifth (D9): owner full access, plus a SELECT-only grant to
-- a teacher of a circle the owner is an active member of, through the existing
-- public.teaches_user() from 20260704000001_user_hifth.sql. No new helper.
-- ---------------------------------------------------------------------------

create table if not exists public.wird (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  -- Scope in pages. For scope_source = 'memorized' these are refreshed from
  -- user_hifth.memorized_ranges on read (D8); the pass in flight keeps the
  -- cycle_page_* bounds it began with so the progress bar never runs backwards.
  page_start int not null,
  page_end int not null,
  scope_source text not null default 'pages' check (scope_source in ('pages', 'memorized')),
  -- Rate: pages_per_period / period_days. Never rounded for storage (C1) —
  -- day n's portion is floor(n·r) − floor((n−1)·r).
  pages_per_period int not null,
  period_days int not null,
  -- Which pass through the scope we are on. Increments silently at the wrap (D7).
  cycle_seq int not null default 1,
  cycle_page_start int not null,
  cycle_page_end int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Soft delete (D19). Entries survive and keep feeding the streak.
  deleted_at timestamptz,
  constraint wird_pages_chk
    check (page_start >= 1 and page_start <= page_end and page_end <= 604),
  constraint wird_cycle_pages_chk
    check (cycle_page_start >= 1 and cycle_page_start <= cycle_page_end and cycle_page_end <= 604),
  constraint wird_rate_chk
    check (pages_per_period >= 1 and period_days >= 1)
);

create table if not exists public.wird_entry (
  id uuid primary key default gen_random_uuid(),
  wird_id uuid not null references public.wird(id) on delete cascade,
  entry_date date not null,
  page_start int not null,
  page_end int not null,
  -- Copied from the wird at write time so a wrap does not restate history.
  cycle_seq int not null,
  created_at timestamptz not null default now()
);

alter table public.wird enable row level security;
alter table public.wird_entry enable row level security;

-- The daily screen's list: this user's live wirds in creation order (F1).
create index if not exists wird_user_active_idx
  on public.wird (user_id, created_at)
  where deleted_at is null;

-- Position (D3) and the done-today check: entries of one wird's current cycle.
create index if not exists wird_entry_wird_cycle_idx
  on public.wird_entry (wird_id, cycle_seq, page_end);

-- ---------------------------------------------------------------------------
-- RLS — wird
-- ---------------------------------------------------------------------------
drop policy if exists "Wird owner reads" on public.wird;
create policy "Wird owner reads"
  on public.wird for select
  using (user_id = auth.uid());

drop policy if exists "Wird owner inserts" on public.wird;
create policy "Wird owner inserts"
  on public.wird for insert
  with check (user_id = auth.uid());

-- with check mirrors using so a wird cannot be handed to another user.
drop policy if exists "Wird owner updates" on public.wird;
create policy "Wird owner updates"
  on public.wird for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Wird owner deletes" on public.wird;
create policy "Wird owner deletes"
  on public.wird for delete
  using (user_id = auth.uid());

-- Read only. A teacher never writes a wird — homework is the prescription
-- primitive, and no substitute grant (covers_membership) applies here.
drop policy if exists "Teacher reads student wird" on public.wird;
create policy "Teacher reads student wird"
  on public.wird for select
  using (public.teaches_user(user_id));

-- ---------------------------------------------------------------------------
-- RLS — wird_entry. Every policy gates on the parent wird, so an entry can
-- never be written against a wird the caller does not own. The subquery is
-- itself subject to wird's RLS above, which is what makes the teacher's read
-- work without a second helper.
-- ---------------------------------------------------------------------------
drop policy if exists "Wird entry owner reads" on public.wird_entry;
create policy "Wird entry owner reads"
  on public.wird_entry for select
  using (exists (
    select 1 from public.wird w
    where w.id = wird_entry.wird_id and w.user_id = auth.uid()
  ));

drop policy if exists "Wird entry owner inserts" on public.wird_entry;
create policy "Wird entry owner inserts"
  on public.wird_entry for insert
  with check (exists (
    select 1 from public.wird w
    where w.id = wird_entry.wird_id and w.user_id = auth.uid()
  ));

drop policy if exists "Wird entry owner updates" on public.wird_entry;
create policy "Wird entry owner updates"
  on public.wird_entry for update
  using (exists (
    select 1 from public.wird w
    where w.id = wird_entry.wird_id and w.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.wird w
    where w.id = wird_entry.wird_id and w.user_id = auth.uid()
  ));

drop policy if exists "Wird entry owner deletes" on public.wird_entry;
create policy "Wird entry owner deletes"
  on public.wird_entry for delete
  using (exists (
    select 1 from public.wird w
    where w.id = wird_entry.wird_id and w.user_id = auth.uid()
  ));

drop policy if exists "Teacher reads student wird entry" on public.wird_entry;
create policy "Teacher reads student wird entry"
  on public.wird_entry for select
  using (exists (
    select 1 from public.wird w
    where w.id = wird_entry.wird_id and public.teaches_user(w.user_id)
  ));

-- Reuses the shared trigger function added with agenda_item.
drop trigger if exists wird_set_updated_at on public.wird;
create trigger wird_set_updated_at
  before update on public.wird
  for each row execute function public.set_updated_at();
