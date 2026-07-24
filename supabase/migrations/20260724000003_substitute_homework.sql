-- 0013 follow-up — a covering substitute can SEE and MARK homework.
--
-- Marking a homework in this app is not a write to `homework`: it is a
-- progress_log INSERT carrying homework_id + grade fields (see logAndReview /
-- TeacherResultForm). So the sub needs exactly three things:
--   * read the prescription (homework SELECT),
--   * insert a result against it (progress_log INSERT),
--   * the same past-deadline exemption the teacher has.
-- Authoring homework (prescribe / edit deadline / delete) stays teacher-only:
-- a temporary principal marks the work, it does not set it.
--
-- Everything remains keyed on covers_membership(), so it expires with the
-- coverage window like the rest of 0013 (B1/B4).

-- ===========================================================================
-- 1. Read the prescription (mirrors "Student reads own homework", 20260701000004:145).
-- ===========================================================================
create policy "Substitute reads covered homework"
  on public.homework for select
  using (public.covers_membership(membership_id));

-- ===========================================================================
-- 2. Submit a result on the student's behalf (mirrors "Teacher inserts halaqah
--    logs", 20260705000006:4). INSERT only — the sub's UPDATE path is still the
--    grade-fields-only policy from 20260723000001.
-- ===========================================================================
create policy "Substitute inserts covered logs"
  on public.progress_log for insert
  with check (public.covers_membership(membership_id));

-- ===========================================================================
-- 3. Deadline hard-lock: exempt the covering sub exactly as the teacher is.
--    A sub covering a session after the deadline must still be able to record
--    what happened in it. Students stay locked (E4/D10).
-- ===========================================================================
create or replace function public.guard_homework_deadline()
  returns trigger language plpgsql security definer
  set search_path = public
as $$
begin
  if new.homework_id is not null
    and not public.teaches_membership(new.membership_id)
    and not public.covers_membership(new.membership_id)
    and exists (
      select 1 from public.homework
      where id = new.homework_id
        and deadline is not null
        and deadline < current_date
    ) then
    raise exception 'Cannot link a submission to a past-deadline homework';
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- 4. Attribution on INSERT (E2/E3). The existing stamping guard is UPDATE-only,
--    so a result submitted on the student's behalf — by a teacher OR a sub —
--    landed with graded_by null. Stamp it at insert time for any non-owner
--    write; the owning student's own submissions stay null, as before.
-- ===========================================================================
create or replace function public.stamp_progress_log_insert()
  returns trigger language plpgsql security definer
  set search_path = public
as $$
begin
  if public.owns_membership(new.membership_id) then
    new.graded_by := null;
  else
    new.graded_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists progress_log_insert_stamp on public.progress_log;
create trigger progress_log_insert_stamp
  before insert on public.progress_log
  for each row execute function public.stamp_progress_log_insert();

-- ===========================================================================
-- 5. covering_sessions() += student_statuses. The result form needs the
--    circle's student-status chips, and a sub cannot read `circle` (D5) — this
--    RPC is their only channel for it. Recreated verbatim from
--    20260724000002 with the one extra column.
-- ===========================================================================
drop function if exists public.covering_sessions();

create or replace function public.covering_sessions()
  returns table (
    membership_id uuid,
    scheduled_at timestamptz,
    circle_id uuid,
    student_name text,
    circle_name text,
    teacher_name text,
    teacher_statuses jsonb,
    student_statuses jsonb,
    default_set_id uuid,
    teacher_id uuid
  )
  language sql security definer stable
  set search_path = public
as $$
  select
    s.membership_id,
    s.scheduled_at,
    c.id as circle_id,
    trim(coalesce(sp.first_name, '') || ' ' || coalesce(sp.last_name, '')) as student_name,
    c.name as circle_name,
    trim(coalesce(tp.first_name, '') || ' ' || coalesce(tp.last_name, '')) as teacher_name,
    c.teacher_statuses,
    c.student_statuses,
    ds.id as default_set_id,
    c.teacher_id
  from public.substitution s
  join public.membership m on m.id = s.membership_id
  join public.circle c on c.id = m.circle_id
  left join public.profiles sp on sp.id = m.user_id
  left join public.profiles tp on tp.id = c.teacher_id
  -- LATERAL … LIMIT 1: nothing forbids two is_default sets for one user, and a
  -- plain join would then fan a coverage row out into duplicates.
  left join lateral (
    select st.id
    from public.annotation_sets st
    where st.user_id = m.user_id and st.is_default
    order by st.created_at
    limit 1
  ) ds on true
  where s.substitute_user_id = auth.uid()
    and now() <= s.scheduled_at + interval '12 hours'
  order by s.scheduled_at;
$$;

grant execute on function public.covering_sessions() to authenticated;
