-- The picker's Orange (#f97316) became Yellow (#f59e0b). Marks already drawn keep the
-- colour they were saved with, so the swatch and the page would disagree until every
-- stored orange is rewritten — that is what this does.
--
-- Two stored spellings, because the highlighter bakes its opacity into the colour:
--   pen / shapes / text : "#f97316"
--   highlighter         : "rgba(249,115,22,0.4)"  (any alpha, with or without spaces)
-- The replace is textual over the serialized canvas. The hex only ever appears as a
-- colour value; the one thing it could otherwise hit is a text annotation whose body is
-- literally "#f97316", which is not worth guarding against.
update public.annotations
set canvas_json = regexp_replace(
      -- Keeps the rgb( / rgba( prefix intact, so an alpha (if any) still follows.
      regexp_replace(canvas_json::text, '#f97316', '#f59e0b', 'gi'),
      '(rgba?\()\s*249\s*,\s*115\s*,\s*22\s*', '\1245,158,11', 'gi'
    )::jsonb,
    mark_colors = case
      when mark_colors is null then null
      else regexp_replace(mark_colors::text, '#f97316', '#f59e0b', 'gi')::jsonb
    end
where canvas_json::text ~* '(#f97316|rgba?\(\s*249\s*,\s*115\s*,\s*22)'
   or mark_colors::text ~* '#f97316';
