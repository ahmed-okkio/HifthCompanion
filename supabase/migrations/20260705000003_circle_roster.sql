-- Student circle view: let an active member see who else is in the circle
-- (teacher + fellow active students), names only. Membership SELECT RLS still
-- restricts a student to their own row, so we expose the roster through a
-- security-definer RPC that returns *only* identity (user_id, role, name) — no
-- schedule, status, or progress leaks between peers. Gated: the caller must be
-- an active member of the circle.
create or replace function public.circle_roster(_circle uuid)
  returns table (user_id uuid, role text, first_name text, last_name text)
  language sql security definer stable
  set search_path = public
as $$
  select m.user_id, m.role, p.first_name, p.last_name
  from public.membership m
  left join public.profiles p on p.id = m.user_id
  where m.circle_id = _circle
    and (m.status = 'active' or m.role = 'teacher')
    and public.is_active_member(_circle)
  order by (m.role = 'teacher') desc, m.joined_at;
$$;

grant execute on function public.circle_roster(uuid) to authenticated;
