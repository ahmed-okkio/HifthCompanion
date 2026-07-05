-- Create exam table
create table public.exam (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.membership(id) on delete cascade,
  scheduled_date date not null,
  surah integer check (surah >= 1 and surah <= 114),
  ayah_start integer check (ayah_start >= 1),
  ayah_end integer check (ayah_end >= 1),
  page_start integer not null check (page_start >= 1 and page_start <= 604),
  page_end integer not null check (page_end >= 1 and page_end <= 604),
  -- Full covered set (mix of juz/surah entries) preserved verbatim for display;
  -- page_start/end stay as a derived span for reader-linking. [{kind,juz|surah,...}]
  entries jsonb not null default '[]'::jsonb,
  status text not null default 'scheduled' check (status in ('scheduled', 'passed', 'failed')),
  teacher_notes text,
  created_at timestamptz not null default now(),
  check (page_end >= page_start)
);

alter table public.exam enable row level security;

create index exam_membership_idx on public.exam (membership_id);
create index exam_date_idx on public.exam (scheduled_date);

-- RLS Policies
create policy "Teacher manages exams"
  on public.exam for all
  using (public.teaches_active_membership(membership_id))
  with check (public.teaches_active_membership(membership_id));

create policy "Student reads own exams"
  on public.exam for select
  using (public.owns_membership(membership_id));
