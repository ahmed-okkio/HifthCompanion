-- Progression Tracker M1-1/M1-2: halaqah (with config columns) + membership tables.
-- Config (log_types/statuses) stored as jsonb columns on halaqah, seeded with
-- standard defaults on insert (M1-2). Membership carries per-membership role,
-- the student-designated shared annotation set, and lifecycle status (M1-12).

-- ---------------------------------------------------------------------------
-- halaqah
-- ---------------------------------------------------------------------------
create table public.halaqah (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users default auth.uid(),
  name text not null,
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  -- M3 recurrence rule; nullable in M1.
  schedule jsonb,
  -- M1-2 configurable, seeded defaults. Each log type: {label, role}.
  log_types jsonb not null default
    '[{"label":"Sabaq","role":"memorize"},{"label":"Sabqi","role":"revise"},{"label":"Manzil","role":"revise"}]'::jsonb,
  -- Self-reported status. Each: {label, polarity}.
  student_statuses jsonb not null default
    '[{"label":"Done","polarity":"positive"},{"label":"Partial","polarity":"neutral"},{"label":"Struggled","polarity":"negative"}]'::jsonb,
  -- Teacher grade. Each: {label, polarity}.
  teacher_statuses jsonb not null default
    '[{"label":"Excellent","polarity":"positive"},{"label":"Good","polarity":"positive"},{"label":"Needs work","polarity":"negative"}]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.halaqah enable row level security;

-- ---------------------------------------------------------------------------
-- membership
-- ---------------------------------------------------------------------------
create table public.membership (
  id uuid primary key default gen_random_uuid(),
  halaqah_id uuid not null references public.halaqah(id) on delete cascade,
  user_id uuid not null references auth.users default auth.uid(),
  role text not null default 'student' check (role in ('teacher', 'student')),
  -- Student-designated shared set the teacher may read for this membership.
  shared_set_id uuid references public.annotation_sets(id) on delete set null,
  -- active → live; inactive → archived (offboarding); blocked → cannot rejoin.
  status text not null default 'active' check (status in ('active', 'inactive', 'blocked')),
  joined_at timestamptz not null default now(),
  -- One membership per user per halaqah.
  unique (halaqah_id, user_id)
);

alter table public.membership enable row level security;

create index membership_halaqah_idx on public.membership (halaqah_id);
create index membership_user_idx on public.membership (user_id);

-- ---------------------------------------------------------------------------
-- Security-definer helpers — bypass RLS to break the halaqah<->membership
-- recursion that direct policy subqueries would cause.
-- ---------------------------------------------------------------------------
create or replace function public.is_halaqah_teacher(_halaqah uuid)
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.halaqah
    where id = _halaqah and teacher_id = auth.uid()
  );
$$;

create or replace function public.is_active_member(_halaqah uuid)
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.membership
    where halaqah_id = _halaqah
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- halaqah RLS
-- ---------------------------------------------------------------------------
-- Teacher (creator) manages own halaqat.
create policy "Teacher manages own halaqah"
  on public.halaqah for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

-- Members read halaqat they belong to.
create policy "Members read their halaqah"
  on public.halaqah for select
  using (public.is_active_member(id));

-- Anyone authenticated may look up a halaqah by invite code to join.
-- (Join itself is gated by the membership insert policy below.)
create policy "Authenticated can read halaqah for join"
  on public.halaqah for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- membership RLS
-- ---------------------------------------------------------------------------
-- User reads own memberships.
create policy "User reads own membership"
  on public.membership for select
  using (user_id = auth.uid());

-- Teacher reads all memberships in their halaqat.
create policy "Teacher reads halaqah memberships"
  on public.membership for select
  using (public.is_halaqah_teacher(halaqah_id));

-- User self-joins (insert own student membership). Blocked users are stopped
-- by the absence of any existing row; re-join attempts after block hit the
-- unique constraint + the not-blocked guard.
create policy "User self-joins as student"
  on public.membership for insert
  with check (
    user_id = auth.uid()
    and role = 'student'
    and not exists (
      select 1 from public.membership m
      where m.halaqah_id = membership.halaqah_id
        and m.user_id = auth.uid()
        and m.status = 'blocked'
    )
  );

-- User updates own membership. Column-level rules (only shared_set_id, and only
-- to a set the user owns) are enforced by the trigger below — RLS WITH CHECK
-- cannot see OLD, so it cannot freeze columns on its own.
create policy "User updates own membership"
  on public.membership for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Teacher manages memberships in their halaqat (remove/block, invite). Column
-- rules (may change status only, never a student's shared_set_id) enforced by
-- the trigger below.
create policy "Teacher manages halaqah memberships"
  on public.membership for all
  using (public.is_halaqah_teacher(halaqah_id))
  with check (public.is_halaqah_teacher(halaqah_id));

-- Does the current user own the given annotation set? Definer so the membership
-- trigger can validate shared_set_id without exposing other users' sets.
create or replace function public.owns_set(_set uuid)
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.annotation_sets
    where id = _set and user_id = auth.uid()
  );
$$;

-- Column-level guard for membership UPDATE.
--  * The member (student) may change ONLY shared_set_id, and only to a set they
--    own — preventing them from sharing another user's private set, or editing
--    their own role/status/halaqah_id.
--  * Anyone else (the teacher, gated by RLS) may change ONLY status — never a
--    student's designated shared_set_id, role, user_id, or halaqah_id.
create or replace function public.guard_membership_update()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if old.user_id = auth.uid() then
    if new.user_id    is distinct from old.user_id
       or new.halaqah_id is distinct from old.halaqah_id
       or new.role       is distinct from old.role
       or new.status     is distinct from old.status
    then
      raise exception 'Member may only change their shared set';
    end if;
    if new.shared_set_id is not null and not public.owns_set(new.shared_set_id) then
      raise exception 'shared_set_id must reference a set you own';
    end if;
    return new;
  end if;

  -- Teacher path.
  if new.user_id       is distinct from old.user_id
     or new.halaqah_id is distinct from old.halaqah_id
     or new.role       is distinct from old.role
     or new.shared_set_id is distinct from old.shared_set_id
  then
    raise exception 'Teacher may only change membership status';
  end if;
  return new;
end;
$$;

create trigger membership_update_guard
  before update on public.membership
  for each row
  execute function public.guard_membership_update();
