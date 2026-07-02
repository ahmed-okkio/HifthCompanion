-- 0005 Hifth Circle rework — FILE 4: SECURITY-CRITICAL RLS (D12/D13, RLS §, S1-S6).
--  * Pending/inactive/blocked memberships grant the teacher ZERO read (S1/S3).
--  * Accept (pending -> active) is self-only; teacher cannot self-accept (S2).
--  * Teacher reads/writes the student's DEFAULT annotation set (D13), replacing the
--    old shared_set model — only the is_default set is exposed (S5).
--  * homework + membership_note policies; homework deadline hard-lock (S4/E4).
--  * progress_log teacher read/grade now require an ACTIVE membership; the existing
--    teacher column-freeze guard is untouched (S6).

-- ===========================================================================
-- 1. progress_log teacher access — require ACTIVE membership (S1/S3).
-- ===========================================================================
drop policy if exists "Teacher reads circle logs" on public.progress_log;
drop policy if exists "Teacher grades circle logs" on public.progress_log;

create policy "Teacher reads circle logs"
  on public.progress_log for select
  using (public.teaches_active_membership(membership_id));

create policy "Teacher grades circle logs"
  on public.progress_log for update
  using (public.teaches_active_membership(membership_id))
  with check (public.teaches_active_membership(membership_id));

-- ===========================================================================
-- 2. Consent-aware membership column-freeze (S2). Replaces FILE 1's interim guard.
--    Student(owner): may ONLY accept pending -> active, nothing else.
--    Teacher: may change status (NOT pending -> active) and schedule; not role/etc.
-- ===========================================================================
create or replace function public.guard_membership_update()
  returns trigger language plpgsql security definer
  set search_path = public
as $$
begin
  if old.user_id = auth.uid() then
    -- Owner may touch nothing but the pending->active transition.
    if new.circle_id is distinct from old.circle_id
       or new.user_id  is distinct from old.user_id
       or new.role     is distinct from old.role
       or new.schedule is distinct from old.schedule
    then
      raise exception 'Student may only accept their membership';
    end if;
    if new.status is distinct from old.status
       and not (old.status = 'pending' and new.status = 'active')
    then
      raise exception 'Student may only accept (pending -> active)';
    end if;
    return new;
  end if;

  -- Teacher path (gated to own circle by RLS): status + schedule only.
  if new.circle_id is distinct from old.circle_id
     or new.user_id is distinct from old.user_id
     or new.role    is distinct from old.role
  then
    raise exception 'Teacher may only change membership status or schedule';
  end if;
  -- Teacher must NOT self-accept on the student's behalf.
  if old.status = 'pending' and new.status = 'active' then
    raise exception 'Only the invited user may accept the membership';
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- 3. Default-set read/write (D13). Replaces teacher_can_read_set + its 9 policies.
--    A circle teacher may read AND write the is_default set (and its
--    annotations/notes) of any ACTIVE student in one of his circles.
-- ===========================================================================
drop policy if exists "Teacher reads shared annotation set" on public.annotation_sets;
drop policy if exists "Teacher reads shared set annotations" on public.annotations;
drop policy if exists "Teacher reads shared set notes" on public.notes;
drop policy if exists "Teacher writes shared set annotations (insert)" on public.annotations;
drop policy if exists "Teacher writes shared set annotations (update)" on public.annotations;
drop policy if exists "Teacher writes shared set annotations (delete)" on public.annotations;
drop policy if exists "Teacher writes shared set notes (insert)" on public.notes;
drop policy if exists "Teacher writes shared set notes (update)" on public.notes;
drop policy if exists "Teacher writes shared set notes (delete)" on public.notes;

drop function if exists public.teacher_can_read_set(uuid);

create function public.teacher_reads_default_set(_set uuid)
  returns boolean language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1
    from public.annotation_sets s
    join public.membership m on m.user_id = s.user_id
    join public.circle c on c.id = m.circle_id
    where s.id = _set
      and s.is_default
      and m.role = 'student'
      and m.status = 'active'
      and c.teacher_id = auth.uid()
  );
$$;

-- read
create policy "Teacher reads default annotation set"
  on public.annotation_sets for select
  using (public.teacher_reads_default_set(id));

create policy "Teacher reads default set annotations"
  on public.annotations for select
  using (public.teacher_reads_default_set(set_id));

create policy "Teacher reads default set notes"
  on public.notes for select
  using (public.teacher_reads_default_set(set_id));

-- write (mirrors read; the set row itself stays owner-only)
create policy "Teacher writes default set annotations (insert)"
  on public.annotations for insert
  with check (public.teacher_reads_default_set(set_id));
create policy "Teacher writes default set annotations (update)"
  on public.annotations for update
  using (public.teacher_reads_default_set(set_id))
  with check (public.teacher_reads_default_set(set_id));
create policy "Teacher writes default set annotations (delete)"
  on public.annotations for delete
  using (public.teacher_reads_default_set(set_id));

create policy "Teacher writes default set notes (insert)"
  on public.notes for insert
  with check (public.teacher_reads_default_set(set_id));
create policy "Teacher writes default set notes (update)"
  on public.notes for update
  using (public.teacher_reads_default_set(set_id))
  with check (public.teacher_reads_default_set(set_id));
create policy "Teacher writes default set notes (delete)"
  on public.notes for delete
  using (public.teacher_reads_default_set(set_id));

-- ===========================================================================
-- 4. homework RLS (S4) + deadline hard-lock (E4/D10).
-- ===========================================================================
create policy "Teacher manages homework"
  on public.homework for all
  using (public.teaches_active_membership(membership_id))
  with check (public.teaches_active_membership(membership_id));

create policy "Student reads own homework"
  on public.homework for select
  using (public.owns_membership(membership_id));

-- Reject linking a progress_log to a homework whose deadline has passed.
-- Open logs (homework_id null) and homework with no deadline are never locked.
create or replace function public.guard_homework_deadline()
  returns trigger language plpgsql security definer
  set search_path = public
as $$
begin
  if new.homework_id is not null and exists (
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

drop trigger if exists progress_log_homework_deadline_guard on public.progress_log;
create trigger progress_log_homework_deadline_guard
  before insert or update on public.progress_log
  for each row execute function public.guard_homework_deadline();

-- ===========================================================================
-- 5. membership_note RLS (S4). Teacher(active) + owning student post & read;
--    author_id must be self; append-only (no update/delete in v1).
-- ===========================================================================
create policy "Note participants read"
  on public.membership_note for select
  using (
    public.teaches_active_membership(membership_id)
    or public.owns_membership(membership_id)
  );

create policy "Note participants insert"
  on public.membership_note for insert
  with check (
    author_id = auth.uid()
    and (
      public.teaches_active_membership(membership_id)
      or public.owns_membership(membership_id)
    )
  );
