-- Student self-service leave: widen the owner branch of the membership update
-- guard from accept-only to accept-or-leave.
--   pending -> inactive  = decline the invite
--   active  -> inactive  = leave the circle
-- 'inactive' (not 'blocked') so the teacher can reactivate and the student can
-- rejoin by link — the self-join policy only bars 'blocked' rows.
create or replace function public.guard_membership_update()
  returns trigger language plpgsql security definer
  set search_path = public
as $$
begin
  if old.user_id = auth.uid() then
    if new.circle_id is distinct from old.circle_id
       or new.user_id  is distinct from old.user_id
       or new.role     is distinct from old.role
       or new.schedule is distinct from old.schedule
    then
      raise exception 'Student may only accept or leave their membership';
    end if;
    if new.status is distinct from old.status
       and not (old.status = 'pending' and new.status = 'active')
       and not (old.status in ('pending', 'active') and new.status = 'inactive')
    then
      raise exception 'Student may only accept (pending -> active) or leave (-> inactive)';
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
  if old.status = 'pending' and new.status = 'active' then
    raise exception 'Only the invited user may accept the membership';
  end if;
  return new;
end;
$$;
