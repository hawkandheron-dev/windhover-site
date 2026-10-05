-- Lifelines: major and minor landmarks (M3 round 5, owner's decision).
--
-- The timeline had grown noisy. Every landmark now says whether it is major
-- or minor; Lifelines shows the major ones and hides the minor ones for now,
-- without deleting anything. Texts stay as they are (all major).
--
--   * Councils: only the seven ecumenical councils are major. Two of them were
--     missing and are added below; the other twelve councils become minor.
--   * Plain events: switched off in 20261001120000_ch_active_flags. Sixteen
--     major ones come back; the other nine stay off and are marked minor.
--
-- Idempotent: safe to run again when the migrations workflow applies it.

alter table "CH_Events"
  add column if not exists significance text not null default 'major';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ch_events_significance_check'
  ) then
    alter table "CH_Events"
      add constraint ch_events_significance_check
      check (significance in ('major', 'minor'));
  end if;
end $$;

-- The two ecumenical councils the data lacked. Descriptions are one line, for
-- the owner to review; citations follow in the data milestone (M5).
insert into "CH_Events" (event_id, name, event_type, event_date, end_date, location, description, reference_url, active, significance)
values
  ('council-constantinople-2', 'Second Council of Constantinople', 'council', '0553-01-01', null, 'Constantinople',
   'Fifth ecumenical council: condemned the Three Chapters, writings judged sympathetic to Nestorius, and reaffirmed Chalcedon. https://en.wikipedia.org/wiki/Second_Council_of_Constantinople',
   'https://en.wikipedia.org/wiki/Second_Council_of_Constantinople', true, 'major'),
  ('council-constantinople-3', 'Third Council of Constantinople', 'council', '0680-01-01', '0681-12-31', 'Constantinople',
   'Sixth ecumenical council: condemned Monothelitism, teaching that Christ has two wills, divine and human. https://en.wikipedia.org/wiki/Third_Council_of_Constantinople',
   'https://en.wikipedia.org/wiki/Third_Council_of_Constantinople', true, 'major')
on conflict do nothing;

-- Councils that are not among the seven ecumenical councils.
update "CH_Events" set significance = 'minor'
where event_id in (
  'event-council-jerusalem', 'council-antioch-268', 'council-arles-314',
  'council-antioch-341', 'council-serdica-343', 'council-ariminum-seleucia-359',
  'council-alexandria-362', 'council-carthage-418', 'council-ephesus-ii-449',
  'event-synod-whitby', 'council-frankfurt', 'event-council-trent'
);

-- Plain events: the sixteen major ones return to the timeline.
update "CH_Events" set active = true, significance = 'major'
where event_id in (
  'event-crucifixion', 'event-pentecost', 'event-fire-rome', 'event-temple-destroyed',
  'event-decian-persecution', 'event-diocletian-persecution', 'event-edict-milan',
  'event-edict-thessalonica', 'event-rome-visigoths', 'event-west-empire-end',
  'event-charlemagne-crowned', 'event-east-west-schism', 'event-first-crusade',
  'event-printing-press', 'event-ottomans-constantinople', 'event-diet-worms'
);

-- The other nine stay off, and say why.
update "CH_Events" set significance = 'minor'
where event_id in (
  'event-hagia-sophia', 'event-iconoclasm-begins', 'event-normans-england',
  'event-investiture-controversy', 'event-hussite-wars', 'event-spanish-inquisition',
  'event-peace-augsburg', 'event-mayflower', 'event-edict-nantes-revoked'
);
