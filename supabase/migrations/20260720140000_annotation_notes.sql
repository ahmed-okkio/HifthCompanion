-- 0011: notes tied to annotations — binding, authorship, soft-delete.
-- No RLS changes: existing notes policies already cover the new columns.

alter table public.notes
  add column fabric_object_id text,
  add column author_id uuid references auth.users(id) default auth.uid(),
  add column deleted_at timestamptz;

create index notes_object_idx on public.notes (set_id, page_number, fabric_object_id);
