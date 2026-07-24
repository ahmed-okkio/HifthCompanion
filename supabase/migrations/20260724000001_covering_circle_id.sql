-- 0013 G2 — the Covering row must deep-link to the covered student's scoped page
-- at /tracker/{circle_id}/student/{membership_id}. A substitute cannot read
-- `membership` or `circle` under RLS (D4/D5), so the circle id has to come from
-- this security-definer RPC alongside the names it already resolves.
-- Return signature changes → drop + recreate. Everything else (the auth.uid()
-- filter, the 12h active window, the grant) is byte-identical to the live
-- 20260723000001 definition.

drop function if exists public.covering_sessions();

create or replace function public.covering_sessions()
  returns table (
    membership_id uuid,
    scheduled_at timestamptz,
    circle_id uuid,
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
    c.id as circle_id,
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
