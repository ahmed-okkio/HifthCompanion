-- Let a teacher submit a homework result on the student's behalf: insert a
-- progress_log for a membership they teach (M-teacher-submit). The app fills the
-- grade fields + reviewed_at in the same insert so it lands as a graded result.
create policy "Teacher inserts halaqah logs"
  on public.progress_log for insert
  with check (public.teaches_membership(membership_id));

-- Teachers aren't bound by the student deadline hard-lock — they may record a
-- result after the deadline. Students stay locked (E4/D10).
create or replace function public.guard_homework_deadline()
  returns trigger language plpgsql security definer
  set search_path = public
as $$
begin
  if new.homework_id is not null
    and not public.teaches_membership(new.membership_id)
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
