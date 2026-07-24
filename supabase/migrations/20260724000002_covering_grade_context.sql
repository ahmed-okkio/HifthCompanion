-- 0013 C4/C5 — surface the two capabilities the DB already grants a covering
-- substitute but the UI could not reach:
--   C4 grading needs the circle's grade labels (`circle.teacher_statuses`), and
--   C5 read-only mushaf needs the covered student's default annotation set id.
-- A sub can read neither `circle` nor `membership` under RLS (D4/D5), so both
-- must come out of this security-definer RPC alongside the names/circle id it
-- already resolves. Return signature changes → drop + recreate. Every other
-- guarantee (auth.uid() filter, the 12h active window, join kinds, ordering,
-- the grant) is byte-identical to the live 20260724000001 definition.

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
    ds.id as default_set_id,
    c.teacher_id
  from public.substitution s
  join public.membership m on m.id = s.membership_id
  join public.circle c on c.id = m.circle_id
  left join public.profiles sp on sp.id = m.user_id
  left join public.profiles tp on tp.id = c.teacher_id
  -- LATERAL … LIMIT 1: nothing in the schema forbids two is_default sets for one
  -- user, and a plain join would then fan a coverage row out into duplicates.
  -- One row max keeps the result set exactly what it was before this migration.
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
