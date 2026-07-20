-- ===========================================================================
-- profiles.email_prefs — per-event email opt-out (0010).
-- ---------------------------------------------------------------------------
-- Absent key ⇒ enabled (default-on), so '{}' for every existing row means all
-- events stay on. No RLS change: the self-only "User updates own profile"
-- policy from 20260626000003_create_profiles.sql is row-level and column-blind,
-- so it already governs writes to this column.
-- ===========================================================================

alter table public.profiles
  add column if not exists email_prefs jsonb not null default '{}'::jsonb;
