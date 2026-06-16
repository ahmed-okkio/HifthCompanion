create table public.annotations (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.annotation_sets(id) on delete cascade,
  page_number integer not null check (page_number >= 1 and page_number <= 604),
  canvas_json jsonb,
  updated_at timestamptz not null default now(),
  unique (set_id, page_number)
);

alter table public.annotations enable row level security;

-- Users can only access annotations belonging to their sets
create policy "Users can manage annotations in their sets"
  on public.annotations
  for all
  using (
    exists (
      select 1 from public.annotation_sets
      where annotation_sets.id = annotations.set_id
        and annotation_sets.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.annotation_sets
      where annotation_sets.id = annotations.set_id
        and annotation_sets.user_id = auth.uid()
    )
  );
