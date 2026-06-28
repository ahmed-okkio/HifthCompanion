-- ===========================================================================
-- Default annotation set — one per user, undeletable.
-- ---------------------------------------------------------------------------
-- Every user gets a default "My Notes" set on signup so the reader always has a
-- place to annotate without first creating one. It cannot be deleted (a BEFORE
-- DELETE trigger blocks it; RLS can't see OLD, same pattern as the tracker
-- guards). Rename is still allowed.
-- ===========================================================================

alter table public.annotation_sets
  add column if not exists is_default boolean not null default false;

-- At most one default per user.
create unique index if not exists annotation_sets_one_default_per_user
  on public.annotation_sets (user_id)
  where is_default;

-- ---------------------------------------------------------------------------
-- Block deletion of the default set.
-- ---------------------------------------------------------------------------
create or replace function public.guard_default_set_delete()
  returns trigger
  language plpgsql
as $$
begin
  if old.is_default then
    raise exception 'The default annotation set cannot be deleted';
  end if;
  return old;
end;
$$;

drop trigger if exists guard_default_set_delete on public.annotation_sets;
create trigger guard_default_set_delete
  before delete on public.annotation_sets
  for each row execute function public.guard_default_set_delete();

-- ---------------------------------------------------------------------------
-- Create a default set for a user if they don't have one yet. security definer
-- so it can run from the signup trigger (no auth.uid() context) and bypass RLS.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_default_set(_user uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  insert into public.annotation_sets (user_id, name, is_default)
  select _user, 'My Notes', true
  where not exists (
    select 1 from public.annotation_sets
    where user_id = _user and is_default
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Extend the signup trigger to also seed the default set (keeps the existing
-- profile insert).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', '')
  )
  on conflict (id) do nothing;

  perform public.ensure_default_set(new.id);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: give every existing user a default set.
-- ---------------------------------------------------------------------------
do $$
declare u record;
begin
  for u in select id from auth.users loop
    perform public.ensure_default_set(u.id);
  end loop;
end;
$$;
