-- ---------------------------------------------------------------------------
-- agenda_item — teacher-private per-student to-do list (PRD 0014, M1).
-- Modeled on membership_note, but strictly teacher-only: the owning student
-- (owns_membership) and substitutes (covers_membership / covers_session) get
-- no grant at all, so RLS denies them by default.
-- ---------------------------------------------------------------------------
create table public.agenda_item (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.membership(id) on delete cascade,
  author_id uuid not null references auth.users default auth.uid(),
  body text not null,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agenda_item enable row level security;

-- Open items per membership: done_at is null sorts first in the index.
create index agenda_item_membership_done_idx
  on public.agenda_item (membership_id, done_at);

create policy "Agenda teacher read"
  on public.agenda_item for select
  using (public.teaches_active_membership(membership_id));

create policy "Agenda teacher insert"
  on public.agenda_item for insert
  with check (
    author_id = auth.uid()
    and public.teaches_active_membership(membership_id)
  );

-- with check mirrors using so an item cannot be moved to another membership.
create policy "Agenda teacher update"
  on public.agenda_item for update
  using (public.teaches_active_membership(membership_id))
  with check (public.teaches_active_membership(membership_id));

create policy "Agenda teacher delete"
  on public.agenda_item for delete
  using (public.teaches_active_membership(membership_id));

-- No shared set_updated_at existed in this repo; this is the first one.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger agenda_item_set_updated_at
  before update on public.agenda_item
  for each row execute function public.set_updated_at();
