-- Set sharing (contract B6): resolve an exact, case-insensitive, trimmed email to
-- a minimal account identity so a set owner can confirm who they're sharing with.
-- Generalizes user_id_by_email: security-definer to read auth.users + join the
-- public.profiles display name. Exact match only (no LIKE / enumeration), returns
-- just id + names. Restricted to authenticated callers.
create or replace function public.account_by_email(_email text)
  returns table (id uuid, first_name text, last_name text)
  language sql security definer stable
  set search_path = public, auth
as $$
  select u.id, p.first_name, p.last_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(_email))
  limit 1;
$$;

revoke all on function public.account_by_email(text) from public, anon;
grant execute on function public.account_by_email(text) to authenticated;
