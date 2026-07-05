-- Preserve the full covered set (mix of juz/surah entries) for display.
-- page_start/end stay as the derived span for reader-linking.
alter table public.exam
  add column if not exists entries jsonb not null default '[]'::jsonb;
