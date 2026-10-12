# Works & Sources links

Every link under a figure's Works & Sources (`CH_Works.text_url`, `CH_Sources.url`)
should go to the work or source it names: its own text if one is online (New
Advent first), else an article *about* it (Wikipedia, the Stanford Encyclopedia,
Britannica). Not the author's page, and not a whole volume.

## Checking them

```bash
node scripts/check-work-links.mjs --sql        # all 448 links; writes .link-audit/ (ignored by git)
node scripts/check-work-links.mjs --only anselm,basil-great   # some figures (works only)
node scripts/check-work-links.mjs --refresh    # ignore the page cache
```

It reads `tests/e2e/data/lifelines-snapshot.json`, so refresh that from the live
tables first (`scripts/lifelines-snapshot.sql`) when links have been edited in the
admin tools. It needs `curl`, and fetches about two pages a second per site, so a first
run takes 30 to 40 minutes; pages are cached in `.link-audit/cache`, so a rerun takes
a few minutes.

For each link it fetches the page, reads its own title, and says one of: *work* (the
title names it), *author* / *volume* (an author's page, or a book of many works),
*dead*, *blocked* (the site refuses scripts: Britannica, Brill, Oxford) or *other*.
For anything that is not a work it looks for a better page (New Advent's Church
Fathers, including the parts of a collection such as Cyprian's treatises; the
author's books on CCEL; the author's works on Wikisource; then Wikipedia) and
proposes it only after fetching it and reading its title. The output is
`report.md` (read it), `report.json`, and `changes.sql` (the proposals as guarded
updates).

Rules it follows, each from a mistake found by reading the first results:

- A Wikipedia article is accepted only if its title matches the work with filler
  words kept ("Against Jovinian" is not "Jovinian"), its opening names the author,
  and it reads like a work (not a film, not a person who shares a word with it).
- A link that is already a text of the work (New Advent, CCEL, Wikisource,
  Gutenberg, archive.org) is not traded for an article about it, and a page the
  script cannot read is not replaced.
- A page found for two different figures' works goes to review, not to the database.
- Titles New Advent gives differently (Irenaeus's Against Heresies is *Adversus
  haereses*) are in a small alias table in the script, each confirmed by hand.

## What was done (2026-10-12)

`supabase/migrations/20261012120000_ch_work_source_links.sql` applies the 130
changes it was sure of (123 works, 7 sources). Each update is guarded by the address
it replaces, so it does not overwrite a link edited since. 146 works were left for
the owner and are listed in the doc "Works & Sources: links still to settle": links
that are dead, links still on an author page where nothing was found, and links that
load but do not clearly name the work. `tests/unit/work-links.test.js` keeps the
migration and the snapshot in agreement and checks none of the changes points back
at an author page.
