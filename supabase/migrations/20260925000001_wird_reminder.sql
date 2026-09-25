-- ===========================================================================
-- Daily wird reminder (0016).
-- ---------------------------------------------------------------------------
-- profiles.wird_reminder_time — the local time of day (in profiles.timezone)
-- to push "N wirds left today". NULL = off. Default 18:00, so every user is
-- enrolled; the push only reaches devices that granted permission.
-- 15-minute steps only: the cron below ticks every 15 minutes and each tick
-- matches exactly one slot, so 18:07 would never fire.
-- No RLS change: the self-only "User updates own profile" policy is
-- column-blind, same reasoning as timezone/locale/email_prefs.
-- ===========================================================================

alter table public.profiles
  add column if not exists wird_reminder_time time default '18:00';

alter table public.profiles
  drop constraint if exists profiles_wird_reminder_time_step_chk;
alter table public.profiles
  add constraint profiles_wird_reminder_time_step_chk
  check (
    wird_reminder_time is null
    or (extract(second from wird_reminder_time) = 0
        and extract(minute from wird_reminder_time)::int % 15 = 0)
  );

-- ---------------------------------------------------------------------------
-- The tick. pg_cron POSTs to the app every 15 minutes; the route
-- (src/app/api/cron/wird-reminder/route.ts) works out who is due. The URL and
-- the bearer secret live in Vault, never in this file — set them once per
-- project in the SQL editor:
--
--   select vault.create_secret('https://<app host>/api/cron/wird-reminder', 'wird_reminder_url');
--   select vault.create_secret('<same value as the app''s CRON_SECRET env>', 'cron_secret');
--
-- Until both exist the job posts to a NULL url and fails harmlessly
-- (visible in cron.job_run_details).
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- cron.schedule upserts by job name, so re-running this migration is safe.
select cron.schedule(
  'wird-reminder',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'wird_reminder_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
