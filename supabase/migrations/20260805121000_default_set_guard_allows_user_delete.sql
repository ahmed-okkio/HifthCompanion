-- guard_default_set_delete also fired for the cascade from a deleted auth user,
-- which made every account undeletable (P0001). The guard exists to stop a user
-- removing their own default set, not to outlive the account. By the time the
-- cascade reaches us the parent row is already gone, so that is the test.
create or replace function public.guard_default_set_delete()
  returns trigger
  language plpgsql
as $$
begin
  if old.is_default
     and exists (select 1 from auth.users where id = old.user_id) then
    raise exception 'The default annotation set cannot be deleted';
  end if;
  return old;
end;
$$;
