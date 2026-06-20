-- Notes table: text notes attached to a page (within an annotation set)
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.annotation_sets(id) on delete cascade,
  page_number integer not null check (page_number >= 1 and page_number <= 604),
  body text not null,
  x float,
  y float,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes enable row level security;

create policy "Users can manage notes in their sets"
  on public.notes
  for all
  using (
    exists (
      select 1 from public.annotation_sets
      where annotation_sets.id = notes.set_id
        and annotation_sets.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.annotation_sets
      where annotation_sets.id = notes.set_id
        and annotation_sets.user_id = auth.uid()
    )
  );
