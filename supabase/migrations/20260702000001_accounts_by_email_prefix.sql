-- Set sharing UX: prefix search so typing "ahmed@" previews matching accounts
-- while adding a collaborator (ShareCard "People with edit access").
--
-- Deliberate relaxation of the exact-match-only rule used by account_by_email:
-- the email-enumeration trade-off is accepted, bounded by
--   * authenticated callers only (no anon),
--   * minimum 3-character prefix,
--   * LIKE wildcards in the input are escaped (prefix match only, no patterns),
--   * at most 5 rows returned.
create or replace function public.accounts_by_email_prefix(_prefix text)
  returns table (id uuid, email text, first_name text, last_name text)
  language sql security definer stable
  set search_path = public, auth
as $$
  select u.id, u.email::text, p.first_name, p.last_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where length(trim(_prefix)) >= 3
    and lower(u.email) like
      replace(replace(replace(lower(trim(_prefix)), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by u.email
  limit 5;
$$;

revoke all on function public.accounts_by_email_prefix(text) from public, anon;
grant execute on function public.accounts_by_email_prefix(text) to authenticated;
