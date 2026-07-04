-- PRD 0008 (revised UX): track a student's self-declared weakest surahs, a list
-- that evolves over time. Stored on the existing user_hifth row as a jsonb array
-- of surah numbers. Existing self read/write + teacher-read policies already
-- cover the whole row, so no new RLS is needed.

alter table public.user_hifth
  add column if not exists weakest_surahs jsonb not null default '[]'::jsonb;
