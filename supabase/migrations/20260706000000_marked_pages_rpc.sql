-- Marked pages per set (PRD 0009, S2): count annotation marks server-side via
-- jsonb_array_length so the client never downloads every page's canvas. Runs as
-- invoker (default) so annotation RLS scopes rows to sets the caller may read (S1).
-- Empty pages are already deleted from the table, so no zero-count rows exist.
create or replace function public.marked_pages(p_set_id uuid)
  returns table (page int, count int)
  language sql stable
as $$
  select page_number as page,
         jsonb_array_length(canvas_json->'objects') as count
  from public.annotations
  where set_id = p_set_id
    and jsonb_array_length(canvas_json->'objects') > 0
  order by count desc, page asc;
$$;
