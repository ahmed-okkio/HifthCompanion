-- 0006 Quran-aware homework (issue 4, A1). A prescription can span multiple
-- surahs; each surah stays one homework row (progress_log.homework_id FK is
-- unchanged, still → homework.id, and grading stays per-row). Rows written by a
-- single prescribe share a generated group_id so the lists render them as one
-- card. Nullable = legacy rows (pre-0006) keep group_id null and render solo.
alter table public.homework
  add column if not exists group_id uuid;

create index if not exists homework_group_idx on public.homework (group_id);
