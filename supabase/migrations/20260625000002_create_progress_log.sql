-- Progression Tracker M1-3: progress_log — the daily student work record.
-- Page-primary (page_start/page_end required) with optional ayah refinement.
-- Student writes own logs (via their membership) until a teacher reviews them;
-- teacher writes only the grade fields (teacher_status/teacher_comment/reviewed_at).

create table public.progress_log (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.membership(id) on delete cascade,
  log_date date not null default current_date,
  log_type text not null,
  page_start integer not null check (page_start >= 1 and page_start <= 604),
  page_end integer not null check (page_end >= 1 and page_end <= 604),
  -- Optional ayah-level refinement (M1-7b, depends on DATA tickets).
  surah integer check (surah >= 1 and surah <= 114),
  ayah_start integer check (ayah_start >= 1),
  ayah_end integer check (ayah_end >= 1),
  student_status text,
  student_notes text,
  teacher_status text,
  teacher_comment text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (page_end >= page_start)
);

alter table public.progress_log enable row level security;

create index progress_log_membership_idx on public.progress_log (membership_id);
create index progress_log_date_idx on public.progress_log (log_date);

-- ---------------------------------------------------------------------------
-- Security-definer helpers — resolve a log's membership to owner / halaqah
-- teacher without recursing through membership RLS.
-- ---------------------------------------------------------------------------
create or replace function public.owns_membership(_membership uuid)
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.membership
    where id = _membership and user_id = auth.uid()
  );
$$;

create or replace function public.teaches_membership(_membership uuid)
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.membership m
    join public.halaqah h on h.id = m.halaqah_id
    where m.id = _membership and h.teacher_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- progress_log RLS
-- ---------------------------------------------------------------------------
-- Student reads own logs.
create policy "Student reads own logs"
  on public.progress_log for select
  using (public.owns_membership(membership_id));

-- Student inserts own logs.
create policy "Student inserts own logs"
  on public.progress_log for insert
  with check (public.owns_membership(membership_id));

-- Student edits/deletes own logs only until a teacher reviews them (M1-8).
create policy "Student edits own unreviewed logs"
  on public.progress_log for update
  using (public.owns_membership(membership_id) and reviewed_at is null)
  with check (public.owns_membership(membership_id) and reviewed_at is null);

create policy "Student deletes own unreviewed logs"
  on public.progress_log for delete
  using (public.owns_membership(membership_id) and reviewed_at is null);

-- Teacher reads logs for memberships in their halaqat.
create policy "Teacher reads halaqah logs"
  on public.progress_log for select
  using (public.teaches_membership(membership_id));

-- Teacher grades logs in their halaqat. Write surface is limited to grade
-- fields at the application layer; a column-restricting trigger guards it here.
create policy "Teacher grades halaqah logs"
  on public.progress_log for update
  using (public.teaches_membership(membership_id))
  with check (public.teaches_membership(membership_id));

-- Prevent a teacher's UPDATE from touching student-owned columns.
create or replace function public.guard_progress_log_teacher_update()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  -- Owner (student) updates are unrestricted here; only constrain non-owners.
  if public.owns_membership(new.membership_id) then
    return new;
  end if;

  if new.membership_id is distinct from old.membership_id
     or new.log_date     is distinct from old.log_date
     or new.log_type     is distinct from old.log_type
     or new.page_start   is distinct from old.page_start
     or new.page_end     is distinct from old.page_end
     or new.surah        is distinct from old.surah
     or new.ayah_start   is distinct from old.ayah_start
     or new.ayah_end     is distinct from old.ayah_end
     or new.student_status is distinct from old.student_status
     or new.student_notes  is distinct from old.student_notes
     or new.created_at     is distinct from old.created_at
  then
    raise exception 'Teacher may only modify grade fields on a progress log';
  end if;

  return new;
end;
$$;

create trigger progress_log_teacher_update_guard
  before update on public.progress_log
  for each row
  execute function public.guard_progress_log_teacher_update();
