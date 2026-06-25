-- Progression Tracker M1-5: resolve an existing user's id from their email so a
-- teacher can invite them. Security-definer to read auth.users; returns only the
-- uuid (no other PII). Restricted to authenticated callers.
create or replace function public.user_id_by_email(_email text)
  returns uuid
  language sql
  security definer
  stable
  set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(_email) limit 1;
$$;

revoke all on function public.user_id_by_email(text) from public, anon;
grant execute on function public.user_id_by_email(text) to authenticated;
