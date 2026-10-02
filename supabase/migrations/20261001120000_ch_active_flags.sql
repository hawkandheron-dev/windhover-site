-- CH Timeline 2.0: an `active` flag on the three content tables, so entries can
-- be taken off the timeline (and put back) by ticking a box rather than by
-- deleting rows or shipping a code change.
--
-- Everything here is idempotent. The flags were applied directly to the project
-- so the PR preview renders correctly; the migrations workflow runs this again
-- when the branch merges to main, and must be a no-op the second time.

alter table "CH_People"    add column if not exists active boolean not null default true;
alter table "CH_Movements" add column if not exists active boolean not null default true;
alter table "CH_Events"    add column if not exists active boolean not null default true;

-- Figures past the Renaissance & Reformation window, plus six the timeline does
-- not need to carry. Louis XIV stays: his reign starts 1643, inside the window,
-- even though it runs on to 1715.
update "CH_People" set active = false
where person_id in (
  'john-wesley', 'charles-wesley', 'george-whitefield',
  'savonarola', 'pico-mirandola', 'nicholas-copernicus',
  'antonio-montesinos', 'william-farel', 'philipp-melanchthon'
);

-- Movements and plain events come off the timeline for now. Councils and
-- documents stay active — they are being promoted to the foreground as pins
-- and flags, not retired.
update "CH_Movements" set active = false;
update "CH_Events" set active = false where event_type = 'event';
