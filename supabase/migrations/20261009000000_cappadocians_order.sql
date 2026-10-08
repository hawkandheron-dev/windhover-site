-- The Cappadocians scene brings its three figures in one at a time. They now
-- arrive oldest first: Macrina the Younger, then Basil, then Gregory of Nyssa
-- (owner, 2026-10-08), so the bars appear left to right instead of jumping
-- back and forth.
update "CH_TourScenes"
  set stagger_ids = array['macrina-younger', 'basil-great', 'gregory-nyssa']
  where scene_id = 'cappadocians';
