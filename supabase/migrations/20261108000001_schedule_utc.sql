-- ===========================================================================
-- membership.schedule → fixed UTC.
-- ---------------------------------------------------------------------------
-- Rules used to follow the teacher's wall clock (schedule.timezone), so when
-- the teacher's zone changed its clocks every student elsewhere saw the
-- session jump an hour. Rules are now stored in UTC: the session instant never
-- moves, and a DST change shifts only the local time of whoever observes it.
--
-- Each existing rule is re-expressed in UTC using the offset in force when
-- this runs, so no session moves today. Weekdays roll when the converted time
-- crosses midnight. Mirrors shiftRule() in src/lib/recurrence.ts.
-- ===========================================================================

with conv as (
  select
    id,
    schedule,
    local_ts,
    (local_ts at time zone (schedule->>'timezone')) at time zone 'UTC' as utc_ts
  from (
    select
      id,
      schedule,
      (now() at time zone (schedule->>'timezone'))::date + (schedule->>'time')::time as local_ts
    from public.membership
    where schedule is not null
      and coalesce(schedule->>'timezone', 'UTC') <> 'UTC'
  ) s
)
update public.membership m
set schedule = c.schedule || jsonb_build_object(
  'time', to_char(c.utc_ts, 'HH24:MI'),
  'timezone', 'UTC',
  'weekdays', (
    select coalesce(jsonb_agg(w order by w), '[]'::jsonb)
    from (
      select distinct ((d::int + (c.utc_ts::date - c.local_ts::date)) % 7 + 7) % 7 as w
      from jsonb_array_elements_text(c.schedule->'weekdays') d
    ) days
  )
)
from conv c
where m.id = c.id;
