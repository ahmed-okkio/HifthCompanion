-- 0006 follow-up: circle membership now creates an explicit set_collaborators
-- grant on accept (student shares their default mushaf with the circle teacher),
-- replacing the implicit "any readable non-owned set" listing on /shared.
-- Backfill the grant for memberships that were already active before this change
-- so those student mushafs show on the teacher's /shared. Idempotent.
insert into public.set_collaborators (set_id, user_id, granted_by)
select s.id, c.teacher_id, m.user_id
from public.membership m
join public.circle c on c.id = m.circle_id
join public.annotation_sets s on s.user_id = m.user_id and s.is_default
where m.role = 'student'
  and m.status = 'active'
  and c.teacher_id <> m.user_id
on conflict (set_id, user_id) do nothing;
