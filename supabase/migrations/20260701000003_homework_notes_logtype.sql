-- 0005 Hifth Circle rework — FILE 3: homework, membership_note, progress_log enum
-- (D6/D7/D9/D10/D11/D15). Tables get RLS enabled here but their POLICIES + the
-- deadline hard-lock trigger live in FILE 4 (security migration).

-- ---------------------------------------------------------------------------
-- homework — the prescription (single student, D9). Status is derived, not stored.
-- ---------------------------------------------------------------------------
create table public.homework (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.membership(id) on delete cascade,
  prescribed_by uuid not null references auth.users default auth.uid(),
  type text not null check (type in ('memorization', 'general_revision', 'targeted_revision')),
  deadline date,
  page_start integer not null check (page_start >= 1 and page_start <= 604),
  page_end integer not null check (page_end >= 1 and page_end <= 604),
  surah integer check (surah >= 1 and surah <= 114),
  ayah_start integer check (ayah_start >= 1),
  ayah_end integer check (ayah_end >= 1),
  instructions text,
  created_at timestamptz not null default now(),
  check (page_end >= page_start)
);

alter table public.homework enable row level security;
create index homework_membership_idx on public.homework (membership_id);

-- ---------------------------------------------------------------------------
-- progress_log gains the optional homework link (D6). null = open self-submission.
-- ---------------------------------------------------------------------------
alter table public.progress_log
  add column if not exists homework_id uuid references public.homework(id) on delete set null;
create index if not exists progress_log_homework_idx on public.progress_log (homework_id);

-- ---------------------------------------------------------------------------
-- Convert progress_log.log_type to the fixed 3-type enum (D7/D15).
-- Map old terminology first, then normalize any stray dev values, then lock it.
-- ---------------------------------------------------------------------------
alter table public.progress_log disable trigger progress_log_teacher_update_guard;
update public.progress_log set log_type = 'memorization'     where log_type = 'Sabaq';
update public.progress_log set log_type = 'general_revision' where log_type in ('Sabqi', 'Manzil');
update public.progress_log set log_type = 'general_revision'
  where log_type not in ('memorization', 'general_revision', 'targeted_revision');
alter table public.progress_log enable trigger progress_log_teacher_update_guard;

alter table public.progress_log
  add constraint progress_log_log_type_check
  check (log_type in ('memorization', 'general_revision', 'targeted_revision'));

-- ---------------------------------------------------------------------------
-- membership_note — per-student attributed teacher<->student thread (D11).
-- ---------------------------------------------------------------------------
create table public.membership_note (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.membership(id) on delete cascade,
  author_id uuid not null references auth.users default auth.uid(),
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.membership_note enable row level security;
create index membership_note_membership_idx on public.membership_note (membership_id);
