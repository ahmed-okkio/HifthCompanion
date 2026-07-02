-- 0005 Hifth Circle rework — FILE 2: per-student sessions (D3).
-- Clean-slate: drop attendance, drop session, recreate session keyed to a
-- MEMBERSHIP (not a circle) with attendance collapsed onto the row. Also defines
-- the active-membership helpers reused by FILE 4.

-- ---------------------------------------------------------------------------
-- Tear down the group-session model (dev/test data only — D15).
-- ---------------------------------------------------------------------------
drop table if exists public.attendance cascade;
drop table if exists public.session cascade;

drop function if exists public.teaches_session(uuid);
drop function if exists public.member_of_session(uuid);

-- ---------------------------------------------------------------------------
-- Active-membership helpers. Pending/inactive/blocked grant nothing (D12/S1/S3).
-- security definer to avoid recursing through membership RLS.
-- ---------------------------------------------------------------------------
create or replace function public.teaches_active_membership(_membership uuid)
  returns boolean language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1 from public.membership m
    join public.circle c on c.id = m.circle_id
    where m.id = _membership
      and c.teacher_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.owns_active_membership(_membership uuid)
  returns boolean language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1 from public.membership
    where id = _membership
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- session — one row per scheduled/ad-hoc 1:1 lesson for a membership.
-- ---------------------------------------------------------------------------
create table public.session (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.membership(id) on delete cascade,
  scheduled_at timestamptz not null,
  is_adhoc boolean not null default false,
  canceled boolean not null default false,
  -- Attendance collapsed onto the row (attendance table dropped). null = unmarked.
  attendance_status text check (attendance_status in ('present', 'absent', 'late', 'excused')),
  created_at timestamptz not null default now(),
  unique (membership_id, scheduled_at)
);

alter table public.session enable row level security;

create index session_membership_idx on public.session (membership_id);
create index session_scheduled_idx on public.session (scheduled_at);

-- ---------------------------------------------------------------------------
-- session RLS — teacher of an ACTIVE membership manages; owning ACTIVE student reads.
-- ---------------------------------------------------------------------------
create policy "Teacher manages member sessions"
  on public.session for all
  using (public.teaches_active_membership(membership_id))
  with check (public.teaches_active_membership(membership_id));

create policy "Student reads own sessions"
  on public.session for select
  using (public.owns_active_membership(membership_id));
