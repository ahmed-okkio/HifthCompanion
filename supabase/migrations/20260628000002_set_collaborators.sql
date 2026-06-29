-- Set edit-sharing (0003) — SECURITY-SENSITIVE cross-user write access.
-- An owner may grant specific account-holders edit access to an annotation set.
-- A collaborator may READ and WRITE annotations/notes inside a shared set, but
-- the set row itself stays owner-only — collaborators cannot rename/delete the
-- set (contract A3), nor re-share it to others (contract A4). Owner-only writes
-- to the grant table enforce A4. Owner-only policies on these tables are
-- preserved; these are additive policies (RLS policies are OR-ed).

-- Grant table: one row per (set, collaborator).
create table public.set_collaborators (
  set_id uuid not null references public.annotation_sets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (set_id, user_id),
  unique (set_id, user_id)
);

alter table public.set_collaborators enable row level security;

-- Owner of the set manages grants; collaborators may only read their own grant
-- (needed for "shared with me"). No collaborator write policy — they cannot
-- re-share (A4).
create policy "Owner manages set collaborators (select)"
  on public.set_collaborators for select
  using (set_id in (select id from public.annotation_sets where user_id = auth.uid()));

create policy "Owner manages set collaborators (insert)"
  on public.set_collaborators for insert
  with check (set_id in (select id from public.annotation_sets where user_id = auth.uid()));

create policy "Owner manages set collaborators (delete)"
  on public.set_collaborators for delete
  using (set_id in (select id from public.annotation_sets where user_id = auth.uid()));

create policy "Collaborator reads own grant"
  on public.set_collaborators for select
  using (user_id = auth.uid());

-- Security-definer helper: is the current user a collaborator on _set? Runs as
-- definer to read grants without subjecting this check to their own RLS.
create or replace function public.is_set_collaborator(_set uuid)
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.set_collaborators
    where set_id = _set and user_id = auth.uid()
  );
$$;

-- annotation_sets: collaborator reads the shared set itself (no update/delete —
-- A3 keeps the set row owner-only).
create policy "Collaborator reads shared annotation set"
  on public.annotation_sets for select
  using (public.is_set_collaborator(id));

-- annotations: collaborator reads/writes annotations within the shared set.
create policy "Collaborator reads shared set annotations"
  on public.annotations for select
  using (public.is_set_collaborator(set_id));

create policy "Collaborator writes shared set annotations (insert)"
  on public.annotations for insert
  with check (public.is_set_collaborator(set_id));

create policy "Collaborator writes shared set annotations (update)"
  on public.annotations for update
  using (public.is_set_collaborator(set_id))
  with check (public.is_set_collaborator(set_id));

create policy "Collaborator writes shared set annotations (delete)"
  on public.annotations for delete
  using (public.is_set_collaborator(set_id));

-- notes: collaborator reads/writes notes within the shared set.
create policy "Collaborator reads shared set notes"
  on public.notes for select
  using (public.is_set_collaborator(set_id));

create policy "Collaborator writes shared set notes (insert)"
  on public.notes for insert
  with check (public.is_set_collaborator(set_id));

create policy "Collaborator writes shared set notes (update)"
  on public.notes for update
  using (public.is_set_collaborator(set_id))
  with check (public.is_set_collaborator(set_id));

create policy "Collaborator writes shared set notes (delete)"
  on public.notes for delete
  using (public.is_set_collaborator(set_id));
