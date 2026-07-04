-- PRD 0008 M1 — user_hifth: a user's memorized ranges + onboarding marker.
-- Owner has full self read/write; a circle teacher may READ the hifth of any
-- ACTIVE student in one of his circles (no teacher write). Mirrors the
-- teacher/active-member semantics of teacher_reads_default_set / is_active_member.

create table if not exists public.user_hifth (
  user_id uuid primary key references auth.users(id) on delete cascade,
  memorized_ranges jsonb not null default '[]'::jsonb,
  onboarded_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_hifth enable row level security;

-- ---------------------------------------------------------------------------
-- Teacher visibility helper. security definer so the policy can see the
-- student's membership without recursing through membership's own RLS.
-- True when the CALLER teaches a circle the _student is an ACTIVE member of.
-- ---------------------------------------------------------------------------
create or replace function public.teaches_user(_student uuid)
  returns boolean language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1
    from public.membership m
    join public.circle c on c.id = m.circle_id
    where m.user_id = _student
      and m.status = 'active'
      and c.teacher_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
create policy "User reads own hifth"
  on public.user_hifth for select
  using (user_id = auth.uid());

create policy "User inserts own hifth"
  on public.user_hifth for insert
  with check (user_id = auth.uid());

create policy "User updates own hifth"
  on public.user_hifth for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Teacher reads student hifth"
  on public.user_hifth for select
  using (public.teaches_user(user_id));
