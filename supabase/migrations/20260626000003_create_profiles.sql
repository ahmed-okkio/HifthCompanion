-- ===========================================================================
-- profiles — display names for tracker members
-- ---------------------------------------------------------------------------
-- Tracker rosters and student timelines previously showed a raw auth-uid slice
-- because no display name existed anywhere readable cross-user. auth.users is
-- not client-readable, so we mirror first/last name into a public.profiles row
-- that RLS can expose to halaqah co-members.
--
-- Populated by a trigger off auth.users (reads the first_name/last_name passed
-- in signUp options.data → raw_user_meta_data), plus a one-time backfill for
-- accounts created before this migration.
-- ===========================================================================

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  first_name  text not null default '',
  last_name   text not null default '',
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- Co-member visibility helper. security definer so the policy can see other
-- users' memberships without recursing through membership's own RLS (same
-- pattern as is_halaqah_teacher / is_active_member).
-- True when the caller shares at least one halaqah with _other (either as the
-- teacher of, or an active member of, a halaqah the other belongs to).
-- ---------------------------------------------------------------------------
create or replace function public.shares_halaqah(_other uuid)
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1
    from public.membership me
    join public.membership them
      on them.halaqah_id = me.halaqah_id
    where me.user_id = auth.uid()
      and them.user_id = _other
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Self: full read/write of own profile.
create policy "User reads own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "User inserts own profile"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "User updates own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Co-members (incl. the teacher) may read each other's display names.
create policy "Co-members read profile"
  on public.profiles for select
  using (public.shares_halaqah(id));

-- ---------------------------------------------------------------------------
-- Auto-create a profile row on signup from the metadata the client supplied.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Backfill: ensure every existing user has a (possibly empty) profile row so
-- the join never misses. Names pulled from any metadata already present.
-- ---------------------------------------------------------------------------
insert into public.profiles (id, first_name, last_name)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'first_name', ''),
  coalesce(u.raw_user_meta_data ->> 'last_name', '')
from auth.users u
on conflict (id) do nothing;
