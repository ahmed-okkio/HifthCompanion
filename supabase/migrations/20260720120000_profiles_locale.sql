-- ===========================================================================
-- profiles.locale — recipient UI language for outgoing email (0010 amendment).
-- ---------------------------------------------------------------------------
-- NULLABLE: null means "unknown", and templates fall back to the original
-- bilingual body. Existing rows stay null until the user touches the language
-- switcher, so nobody silently loses a language they were reading.
-- No RLS change: the self-only "User updates own profile" policy from
-- 20260626000003_create_profiles.sql is row-level and column-blind, so it
-- already governs writes to this column.
-- ===========================================================================

alter table public.profiles
  add column if not exists locale text;
