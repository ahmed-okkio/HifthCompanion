-- Progression Tracker M1-4 — SECURITY-CRITICAL cross-user read access.
-- A teacher may READ (never write) a student's shared annotation set and its
-- annotations/notes, but only for an ACTIVE membership in a halaqah the teacher
-- owns. Inactive/blocked membership → access drops immediately (M1-12).
-- Owner-only policies on these tables are preserved; these are additive SELECT
-- policies (RLS policies are OR-ed).

-- Security-definer helper: does the current user teach a halaqah whose active
-- membership designates _set as its shared set? Runs as definer to read
-- membership/halaqah without subjecting this check to their own RLS.
create or replace function public.teacher_can_read_set(_set uuid)
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1
    from public.membership m
    join public.halaqah h on h.id = m.halaqah_id
    where m.shared_set_id = _set
      and m.status = 'active'
      and h.teacher_id = auth.uid()
  );
$$;

-- annotation_sets: teacher reads the shared set itself.
create policy "Teacher reads shared annotation set"
  on public.annotation_sets for select
  using (public.teacher_can_read_set(id));

-- annotations: teacher reads annotations within the shared set.
create policy "Teacher reads shared set annotations"
  on public.annotations for select
  using (public.teacher_can_read_set(set_id));

-- notes: teacher reads notes within the shared set.
create policy "Teacher reads shared set notes"
  on public.notes for select
  using (public.teacher_can_read_set(set_id));
