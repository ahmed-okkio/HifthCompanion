-- One student membership per (teacher, student): a user cannot join two circles
-- owned by the same teacher. This makes the (teacher, student) -> membership map
-- unambiguous, so the shared-Mushaf view can resolve a single student page link.

create or replace function public.one_circle_per_teacher()
  returns trigger language plpgsql security definer
  set search_path = public
as $$
begin
  if new.role <> 'student' then
    return new;
  end if;
  if exists (
    select 1
    from public.membership m
    join public.circle c_old on c_old.id = m.circle_id
    join public.circle c_new on c_new.id = new.circle_id
    where m.user_id = new.user_id
      and m.role = 'student'
      and m.status <> 'blocked'
      and m.circle_id <> new.circle_id
      and c_old.teacher_id = c_new.teacher_id
  ) then
    raise exception 'You are already in a circle from this teacher';
  end if;
  return new;
end;
$$;

create trigger membership_one_circle_per_teacher
  before insert on public.membership
  for each row execute function public.one_circle_per_teacher();
