-- Refreshes tests/e2e/data/lifelines-snapshot.json, the real data that
-- scripts/lifelines-shots.mjs renders. Read-only. Run in the Supabase SQL
-- editor (or via the Supabase connector), copy the single `snapshot` value,
-- and save it over the JSON file, keeping its `_meta` block with a new date.
--
-- The table list must match what timeline-scratch/src/data/churchHistory2Adapter.js
-- and churchHistorySupabaseAdapter.js (fetchTourScenes) read. If the adapter
-- starts reading a new table, add it here too, or the screenshots will show
-- that feature empty.
select json_build_object(
  'CH_People',           (select json_agg(x order by birth_year, person_id) from "CH_People" x),
  'CH_Events',           (select json_agg(x order by event_date, event_id) from "CH_Events" x),
  'CH_Connections',      (select json_agg(x order by connection_id) from "CH_Connections" x),
  'CH_Sources',          (select json_agg(x order by source_id) from "CH_Sources" x),
  'CH_Source_Figures',   (select json_agg(x order by id) from "CH_Source_Figures" x),
  'CH_Works',            (select json_agg(x order by person_id, work_id) from "CH_Works" x),
  'CH_Movements',        (select json_agg(x order by start_year, movement_id) from "CH_Movements" x),
  'CH_Movement_Figures', (select json_agg(x order by id) from "CH_Movement_Figures" x),
  'CH_Movement_Events',  (select json_agg(x order by id) from "CH_Movement_Events" x),
  'CH_EventConnections', (select json_agg(x order by id) from "CH_EventConnections" x),
  'CH_TourScenes',       (select json_agg(x order by scene_order) from "CH_TourScenes" x)
) as snapshot;
