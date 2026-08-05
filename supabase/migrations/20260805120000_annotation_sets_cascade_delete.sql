-- Deleting an auth user failed with 23503: annotation_sets.user_id had no delete
-- rule, and every user owns at least the default "My Notes" set, so the FK pinned
-- every row in auth.users. A set belongs to its owner, so it goes with them.
alter table public.annotation_sets
  drop constraint annotation_sets_user_id_fkey,
  add constraint annotation_sets_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade;
