-- ===========================================================================
-- profiles.timezone — recipient IANA timezone for outgoing email (0010).
-- ---------------------------------------------------------------------------
-- Teacher and student are frequently in different timezones, so the circle's
-- schedule timezone is not always the right one to render a time in. This
-- column holds the recipient's own zone, captured client-side from
-- Intl.DateTimeFormat().resolvedOptions().timeZone.
-- NULLABLE: null means "unknown", and the send path falls back to the circle's
-- schedule timezone, then UTC.
-- No RLS change: the self-only "User updates own profile" policy from
-- 20260626000003_create_profiles.sql is row-level and column-blind, so it
-- already governs writes to this column — same reasoning as locale/email_prefs.
-- ===========================================================================

alter table public.profiles
  add column if not exists timezone text;
