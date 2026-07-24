-- 0013 Substitute teacher — DATA layer (PRD 0013, D1–D14; contract A/B/C/D/E/G/I).
-- A circle teacher hands a specific session INSTANT to another existing teacher (the
-- substitute). Coverage is a function of the data — a non-expired substitution row —
-- not a flag: a row grants scoped access until scheduled_at + 12h, then self-expires.
-- Nothing range-shaped is stored (I2); reclaim is a plain delete (A5). Instant-keyed
-- like moved_from, so it binds a VIRTUAL slot with no materialization (A3).
--
-- Mirrors the codebase precedents:
--  * teaches_active_membership / teacher_reads_default_set split (20260701000004).
--  * progress_log column-freeze guard (20260625000002:99-133).
--  * profiles join for display names (20260705000003 circle_roster).

-- ===========================================================================
-- 1. substitution table (D1/A1/A2) + attribution columns (D7/E1-E3).
-- ===========================================================================
create table public.substitution (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.membership(id) on delete cascade,
  scheduled_at timestamptz not null,
  substitute_user_id uuid not null references auth.users(id),
  -- created_by is server-stamped by the insert guard below (A4) — never trust the client.
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (membership_id, scheduled_at)   -- one sub per instant; "change sub" is an upsert (A2)
);

alter table public.substitution enable row level security;

create index substitution_substitute_idx on public.substitution (substitute_user_id);
create index substitution_membership_idx on public.substitution (membership_id);

-- Attribution: who actually marked / graded (E1/E2). Null for a student self-write.
alter table public.session add column marked_by uuid references auth.users(id);
alter table public.progress_log add column graded_by uuid references auth.users(id);

-- ===========================================================================
-- 2. Coverage helpers (D5). GRACE = 12h, matching sectionSessions in
--    recurrence.ts:147. Active = now() <= scheduled_at + 12h, no lower bound
--    (access starts at assignment). A past-GRACE row grants NOTHING (B1/B4/D6).
--    security definer so policies don't recurse through substitution's own RLS.
-- ===========================================================================
create or replace function public.covers_membership(_membership uuid)
  returns boolean language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1 from public.substitution s
    where s.membership_id = _membership
      and s.substitute_user_id = auth.uid()
      and now() <= s.scheduled_at + interval '12 hours'
  );
$$;

create or replace function public.covers_session(_membership uuid, _at timestamptz)
  returns boolean language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1 from public.substitution s
    where s.membership_id = _membership
      and s.scheduled_at = _at
      and s.substitute_user_id = auth.uid()
      and now() <= s.scheduled_at + interval '12 hours'
  );
$$;

-- Mirror of teacher_reads_default_set (20260701000004:84) gated on active coverage.
create or replace function public.covers_default_set(_set uuid)
  returns boolean language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1
    from public.annotation_sets st
    join public.membership m on m.user_id = st.user_id
    join public.substitution s on s.membership_id = m.id
    where st.id = _set
      and st.is_default
      and m.role = 'student'
      and m.status = 'active'
      and s.substitute_user_id = auth.uid()
      and now() <= s.scheduled_at + interval '12 hours'
  );
$$;

-- ===========================================================================
-- 3. substitution insert guard (D14/A4/A6/A7). Server-stamps created_by and
--    rejects: non-active-teacher assigner, teacher-as-own-sub, student-as-own-sub.
-- ===========================================================================
create or replace function public.guard_substitution_insert()
  returns trigger language plpgsql security definer
  set search_path = public
as $$
begin
  new.created_by := auth.uid();   -- A4: not client-settable

  if not public.teaches_active_membership(new.membership_id) then
    raise exception 'Only the active circle teacher may assign a substitute';  -- A6 + non-teacher
  end if;

  -- A7: sub may be neither the away teacher nor the student themselves.
  if exists (
    select 1 from public.membership m
    join public.circle c on c.id = m.circle_id
    where m.id = new.membership_id
      and (new.substitute_user_id = c.teacher_id
           or new.substitute_user_id = m.user_id)
  ) then
    raise exception 'Substitute cannot be the away teacher or the student';
  end if;

  return new;
end;
$$;

create trigger substitution_insert_guard
  before insert on public.substitution
  for each row execute function public.guard_substitution_insert();

-- ===========================================================================
-- 4. substitution RLS (D8/A5). Teacher manages; sub reads own rows; student
--    reads rows for their own membership. No update policy — change is an
--    upsert, reclaim is a delete (A5).
-- ===========================================================================
create policy "Teacher manages substitutions"
  on public.substitution for all
  using (public.teaches_active_membership(membership_id))
  with check (public.teaches_active_membership(membership_id));

create policy "Substitute reads own substitutions"
  on public.substitution for select
  using (substitute_user_id = auth.uid());

create policy "Student reads own substitutions"
  on public.substitution for select
  using (public.owns_membership(membership_id));

-- ===========================================================================
-- 5. session — sub read + attendance write (C1/C2) and the column-freeze +
--    attribution guard (D1/E1/E5). session had no freeze before; this adds one.
--    Real teacher may write anything; a covering sub may touch ONLY
--    attendance_status (and its marked_by stamp).
-- ===========================================================================
create policy "Substitute reads covered sessions"
  on public.session for select
  using (public.covers_membership(membership_id));

-- Attendance write scoped to the exact covered instant; insert materializes the slot.
create policy "Substitute marks covered session (insert)"
  on public.session for insert
  with check (public.covers_session(membership_id, scheduled_at));

create policy "Substitute marks covered session (update)"
  on public.session for update
  using (public.covers_session(membership_id, scheduled_at))
  with check (public.covers_session(membership_id, scheduled_at));

create or replace function public.guard_session_write()
  returns trigger language plpgsql security definer
  set search_path = public
as $$
declare
  attendance_touched boolean :=
    case when tg_op = 'UPDATE'
         then new.attendance_status is distinct from old.attendance_status
         else new.attendance_status is not null
    end;
begin
  -- Owner (student) self-write: attendance attribution stays null (E1).
  if public.owns_active_membership(coalesce(new.membership_id, old.membership_id)) then
    new.marked_by := null;
    return new;
  end if;

  -- Substitute (non-teacher, non-owner): frozen to attendance_status only (D1).
  if not public.teaches_active_membership(new.membership_id) then
    if tg_op = 'UPDATE' and (
         new.membership_id is distinct from old.membership_id
      or new.scheduled_at  is distinct from old.scheduled_at
      or new.is_adhoc      is distinct from old.is_adhoc
      or new.canceled      is distinct from old.canceled
      or new.moved_from    is distinct from old.moved_from
      or new.created_at    is distinct from old.created_at
    ) then
      raise exception 'Substitute may only mark attendance on a session';
    end if;
    -- INSERT materializes the slot: only membership_id/scheduled_at/attendance_status
    -- (+ server-stamped marked_by) may be meaningful. Any other column set → reject.
    if tg_op = 'INSERT' and (
         new.is_adhoc
      or new.canceled
      or new.moved_from is not null
    ) then
      raise exception 'Substitute may only mark attendance on a session';
    end if;
  end if;

  -- Teacher or sub: stamp marked_by on the acting user when attendance changes;
  -- otherwise keep the prior value / null so the client can never spoof it (E3).
  if attendance_touched then
    new.marked_by := auth.uid();
  else
    new.marked_by := case when tg_op = 'UPDATE' then old.marked_by else null end;
  end if;
  return new;
end;
$$;

create trigger session_write_guard
  before insert or update on public.session
  for each row execute function public.guard_session_write();

-- ===========================================================================
-- 6. progress_log — sub read + grade (C3/C4). The existing
--    guard_progress_log_teacher_update (20260625000002:99) already freezes
--    EVERY non-owner to grade fields, so the sub path is covered as-is; we only
--    extend it to stamp graded_by (E2/E3). RLS just adds the sub read + grade.
-- ===========================================================================
create policy "Substitute reads covered logs"
  on public.progress_log for select
  using (public.covers_membership(membership_id));

create policy "Substitute grades covered logs"
  on public.progress_log for update
  using (public.covers_membership(membership_id))
  with check (public.covers_membership(membership_id));

create or replace function public.guard_progress_log_teacher_update()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  -- Owner (student) updates are unrestricted; attribution stays null (E2).
  if public.owns_membership(new.membership_id) then
    new.graded_by := null;
    return new;
  end if;

  if new.membership_id is distinct from old.membership_id
     or new.log_date     is distinct from old.log_date
     or new.log_type     is distinct from old.log_type
     or new.page_start   is distinct from old.page_start
     or new.page_end     is distinct from old.page_end
     or new.surah        is distinct from old.surah
     or new.ayah_start   is distinct from old.ayah_start
     or new.ayah_end     is distinct from old.ayah_end
     or new.student_status is distinct from old.student_status
     or new.student_notes  is distinct from old.student_notes
     or new.created_at     is distinct from old.created_at
  then
    raise exception 'Only grade fields may be modified on a progress log';
  end if;

  -- Non-owner grade write (teacher or covering sub): stamp the actor (E2/E3).
  new.graded_by := auth.uid();
  return new;
end;
$$;

-- ===========================================================================
-- 7. Default-set READ for a covering sub (C5/D4). SELECT only — no sub
--    insert/update/delete on annotations/notes (D3). Mirrors the teacher read
--    policies in 20260701000004:102-112.
-- ===========================================================================
create policy "Substitute reads covered default set"
  on public.annotation_sets for select
  using (public.covers_default_set(id));

create policy "Substitute reads covered set annotations"
  on public.annotations for select
  using (public.covers_default_set(set_id));

create policy "Substitute reads covered set notes"
  on public.notes for select
  using (public.covers_default_set(set_id));

-- ===========================================================================
-- 8. covering_sessions() RPC (D11/G3). The caller's ACTIVE coverage only —
--    substitute_user_id = auth.uid() and non-expired (B1). Expired rows drop off
--    with no manual action (I3). security definer because a sub may have no
--    circle of their own and cannot read arbitrary membership/profile rows.
--    ponytail: expiry is by the now()<=... predicate here, not a purge job (I3);
--    add a cleanup cron only if the table ever grows enough to matter.
-- ===========================================================================
create or replace function public.covering_sessions()
  returns table (
    membership_id uuid,
    scheduled_at timestamptz,
    student_name text,
    circle_name text,
    teacher_name text
  )
  language sql security definer stable
  set search_path = public
as $$
  select
    s.membership_id,
    s.scheduled_at,
    trim(coalesce(sp.first_name, '') || ' ' || coalesce(sp.last_name, '')) as student_name,
    c.name as circle_name,
    trim(coalesce(tp.first_name, '') || ' ' || coalesce(tp.last_name, '')) as teacher_name
  from public.substitution s
  join public.membership m on m.id = s.membership_id
  join public.circle c on c.id = m.circle_id
  left join public.profiles sp on sp.id = m.user_id
  left join public.profiles tp on tp.id = c.teacher_id
  where s.substitute_user_id = auth.uid()
    and now() <= s.scheduled_at + interval '12 hours'
  order by s.scheduled_at;
$$;

grant execute on function public.covering_sessions() to authenticated;
