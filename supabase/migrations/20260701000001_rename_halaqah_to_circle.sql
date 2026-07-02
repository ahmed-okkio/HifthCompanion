-- 0005 Hifth Circle rework — FILE 1: rename halaqah -> circle (D2).
-- Renames the table, the membership.halaqah_id column, all FKs/indexes/constraints,
-- the security-definer helpers, and every RLS policy whose NAME or BODY referenced
-- 'halaqah' — so no live table/column/fn/policy identifier contains 'halaqah' (A1).
-- Also drops circle.schedule / circle.log_types / membership.shared_set_id, adds
-- membership.schedule, and widens membership.status to include 'pending' (D3/D4/D12).
-- Sessions/attendance are torn down in FILE 2; here we only drop their halaqah-named
-- policies so the helper-function drops below don't fail on a dependency.

-- ---------------------------------------------------------------------------
-- 1. Drop every policy that references a halaqah identifier or a to-be-dropped fn.
-- ---------------------------------------------------------------------------
drop policy if exists "Teacher manages own halaqah" on public.halaqah;
drop policy if exists "Members read their halaqah" on public.halaqah;
drop policy if exists "Authenticated can read halaqah for join" on public.halaqah;

drop policy if exists "Teacher reads halaqah memberships" on public.membership;
drop policy if exists "Teacher manages halaqah memberships" on public.membership;
drop policy if exists "User self-joins as student" on public.membership;

drop policy if exists "Teacher reads halaqah logs" on public.progress_log;
drop policy if exists "Teacher grades halaqah logs" on public.progress_log;

drop policy if exists "Teacher manages halaqah sessions" on public.session;
drop policy if exists "Members read halaqah sessions" on public.session;
drop policy if exists "Teacher manages session attendance" on public.attendance;
drop policy if exists "Student reads own attendance" on public.attendance;

drop policy if exists "Co-members read profile" on public.profiles;

-- ---------------------------------------------------------------------------
-- 2. Drop the helper fns whose names/bodies carry 'halaqah'. (teacher_can_read_set,
--    teaches_session, member_of_session are dropped in FILE 2/FILE 4.)
-- ---------------------------------------------------------------------------
drop function if exists public.is_halaqah_teacher(uuid);
drop function if exists public.is_active_member(uuid);   -- recreated with _circle param
drop function if exists public.shares_halaqah(uuid);

-- ---------------------------------------------------------------------------
-- 3. Rename the table + its constraints.
-- ---------------------------------------------------------------------------
alter table public.halaqah rename to circle;
alter table public.circle rename constraint halaqah_pkey to circle_pkey;
alter table public.circle rename constraint halaqah_invite_code_key to circle_invite_code_key;

-- circle no longer owns a schedule or configurable log types (D4/D7).
alter table public.circle drop column if exists schedule;
alter table public.circle drop column if exists log_types;

-- ---------------------------------------------------------------------------
-- 4. Rename membership.halaqah_id -> circle_id (+ FK, unique, index).
-- ---------------------------------------------------------------------------
alter table public.membership rename column halaqah_id to circle_id;
alter table public.membership rename constraint membership_halaqah_id_fkey to membership_circle_id_fkey;
alter table public.membership rename constraint membership_halaqah_id_user_id_key to membership_circle_id_user_id_key;
alter index public.membership_halaqah_idx rename to membership_circle_idx;

-- Drop the student-designated shared set (D13 — teacher now reads the default set).
alter table public.membership drop column if exists shared_set_id;

-- Per-student weekly recurrence lives on the membership now (D4).
alter table public.membership add column if not exists schedule jsonb;

-- Consent gate adds 'pending' (D12). Default stays 'active' (teacher self-membership).
alter table public.membership drop constraint if exists membership_status_check;
alter table public.membership
  add constraint membership_status_check
  check (status in ('pending', 'active', 'inactive', 'blocked'));

-- ---------------------------------------------------------------------------
-- 5. Recreate the security-definer helpers against circle / circle_id.
-- ---------------------------------------------------------------------------
create function public.is_circle_teacher(_circle uuid)
  returns boolean language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1 from public.circle
    where id = _circle and teacher_id = auth.uid()
  );
$$;

create function public.is_active_member(_circle uuid)
  returns boolean language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1 from public.membership
    where circle_id = _circle
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

-- teaches_membership: name kept, body now joins circle.
create or replace function public.teaches_membership(_membership uuid)
  returns boolean language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1 from public.membership m
    join public.circle c on c.id = m.circle_id
    where m.id = _membership and c.teacher_id = auth.uid()
  );
$$;

-- shares_halaqah -> shares_circle (co-member profile visibility).
create function public.shares_circle(_other uuid)
  returns boolean language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1
    from public.membership me
    join public.membership them on them.circle_id = me.circle_id
    where me.user_id = auth.uid()
      and them.user_id = _other
  );
$$;

-- ---------------------------------------------------------------------------
-- 6. Membership column-freeze — interim rename-correct version.
--    (FILE 4 replaces this with the consent-aware, schedule-aware version.)
--    shared_set_id logic is gone; teacher may change status, student nothing yet.
-- ---------------------------------------------------------------------------
create or replace function public.guard_membership_update()
  returns trigger language plpgsql security definer
  set search_path = public
as $$
begin
  if old.user_id = auth.uid() then
    if new.circle_id is distinct from old.circle_id
       or new.user_id is distinct from old.user_id
       or new.role    is distinct from old.role
       or new.status  is distinct from old.status
       or new.schedule is distinct from old.schedule
    then
      raise exception 'Member may not change this membership';
    end if;
    return new;
  end if;

  -- Teacher path: status only.
  if new.circle_id is distinct from old.circle_id
     or new.user_id is distinct from old.user_id
     or new.role    is distinct from old.role
  then
    raise exception 'Teacher may only change membership status';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Recreate the renamed policies on circle-named objects.
-- ---------------------------------------------------------------------------
-- circle
create policy "Teacher manages own circle"
  on public.circle for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "Members read their circle"
  on public.circle for select
  using (public.is_active_member(id));

create policy "Authenticated can read circle for join"
  on public.circle for select
  to authenticated
  using (true);

-- membership
create policy "Teacher reads circle memberships"
  on public.membership for select
  using (public.is_circle_teacher(circle_id));

create policy "Teacher manages circle memberships"
  on public.membership for all
  using (public.is_circle_teacher(circle_id))
  with check (public.is_circle_teacher(circle_id));

create policy "User self-joins as student"
  on public.membership for insert
  with check (
    user_id = auth.uid()
    and role = 'student'
    and not exists (
      select 1 from public.membership m
      where m.circle_id = membership.circle_id
        and m.user_id = auth.uid()
        and m.status = 'blocked'
    )
  );

-- progress_log (teacher policies; FILE 4 tightens the read/grade to active-only)
create policy "Teacher reads circle logs"
  on public.progress_log for select
  using (public.teaches_membership(membership_id));

create policy "Teacher grades circle logs"
  on public.progress_log for update
  using (public.teaches_membership(membership_id))
  with check (public.teaches_membership(membership_id));

-- profiles
create policy "Co-members read profile"
  on public.profiles for select
  using (public.shares_circle(id));
