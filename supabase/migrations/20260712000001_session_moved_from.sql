-- Per-session reschedule: a real row can be moved off its recurrence slot.
-- moved_from records the ORIGINAL recurrence instant so the virtual twin at that
-- time is suppressed instead of re-appearing alongside the moved row.
alter table public.session add column if not exists moved_from timestamptz;
