-- Marked count = clustered marks, not raw stroke count. A drawn line is often several
-- Fabric path strokes; the client proximity-groups them and writes the logical count to
-- annotations.mark_count on save. The RPC returns that, falling back to jsonb_array_length
-- for rows saved before this migration (they re-cache on their next save).
alter table public.annotations add column if not exists mark_count int;

create or replace function public.marked_pages(p_set_id uuid)
  returns table (page int, count int)
  language sql stable
as $$
  select page_number as page,
         coalesce(mark_count, jsonb_array_length(canvas_json->'objects')) as count
  from public.annotations
  where set_id = p_set_id
    and coalesce(mark_count, jsonb_array_length(canvas_json->'objects')) > 0
  order by count desc, page asc;
$$;
