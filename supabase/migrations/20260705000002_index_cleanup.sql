-- DB audit cleanup (2026-07-05). Live inspection: all four indexes below have
-- 0 index_scans since creation — speculative "for later" lookups that never
-- came. They only add write amplification on insert/update. Drop them.
-- Kept deliberately (0 scans but NOT droppable): *_pkey, unique constraints
-- (annotation_sets_one_default_per_user, membership_circle_id_user_id_key),
-- and push_subscription_* (feature not live yet).

drop index if exists public.session_scheduled_idx;      -- session read by membership_id, never raw scheduled_at
drop index if exists public.progress_log_date_idx;      -- queries filter membership_id first
drop index if exists public.progress_log_homework_idx;
drop index if exists public.homework_group_idx;

-- notes is read by (set_id, page_number) on every reader page open (getNotes)
-- but had no supporting index. Cheap insurance; pays off once notes-per-page grows.
create index if not exists notes_set_page_idx on public.notes (set_id, page_number);
