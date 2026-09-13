-- Per-colour mark counts for the Annotations panel: a page row shows a chip per colour
-- ("4 red, 2 orange"), so the RPC has to return the breakdown alongside the total.
--
-- The counts are written by the client on save, not aggregated here. A raw
-- `group by stroke` over canvas_json->'objects' would count STROKES, and mark_count
-- counts CLUSTERS (clusterCount() merges the several strokes of one drawn mark) — the
-- two would disagree, and the chips would not sum to the badge beside them. The client
-- already computes the clusters to write mark_count, so it writes their colours too.
-- Rows saved before this migration have a null mark_colors and show no chips until
-- their next save.
alter table public.annotations add column if not exists mark_colors jsonb;

-- Adding an OUT column changes the signature, so the old function has to go first.
drop function if exists public.marked_pages(uuid);

create function public.marked_pages(p_set_id uuid)
  returns table (page int, count int, colors jsonb)
  language sql stable
as $$
  select page_number as page,
         coalesce(mark_count, jsonb_array_length(canvas_json->'objects')) as count,
         mark_colors as colors
  from public.annotations
  where set_id = p_set_id
    and coalesce(mark_count, jsonb_array_length(canvas_json->'objects')) > 0
  order by count desc, page asc;
$$;
