# Lifelines release plan

> **Status:** M1 merged ([hawkandheron-dev/windhover-site#158](https://github.com/hawkandheron-dev/windhover-site/pull/158)). M2 is open as [hawkandheron-dev/windhover-site#159](https://github.com/hawkandheron-dev/windhover-site/pull/159), and Matthew's preview check passed 5/5. For step 2, `/?admin` showing a Sign In button while signed out is the intended result: `?admin` only reveals the button, and the admin tools appear after signing in. Still to confirm: plain `/` shows no Sign In button. M2 merged. **Now: M3**, detailed in the next section. Sync this file to `docs/lifelines-release-plan.md` on the next commit.

## Detail frame, realm colours, century cursor line (2026-10-08)

Matthew: drop "Era:" from the popup; frame it in the entry's colour with a thicker top band naming the type in white ("Emperors & monarchs", "Church figure", "Council", "Text", "Event", "Year"); colour monarchs by realm, with the unified empire maroon; check contrast. Then: the pointer's year line in the century's colour, 2–3px thicker.

**Done (on PR #165):**
- `detailTypeBand` (config): a 3px frame plus a band; light colours are darkened to 4.5:1 by `readableOnWhite`; the band replaces "Era:".
- `REALM_STYLES`: maroon `#7a1f2b` (Roman Empire), purple `#5b3a86` (Eastern), rust `#9a4a1e` (Western), slate `#4a5a6a` (later kingdoms). The strip and the phone column use them (`rulerColorByRealm`).
- `cursorLine`: 3px in the century colour; the pinned line and the Year dialog's band match.
- Tests: unit `readable-color`, and three e2e tests in "Tour polish". Shots: new `detail-ruler`, `detail-text`, `year`, `cursor` states.

## Now: "Yes to all" follow-ups (2026-10-08). Code is written, not yet committed

**Context.** PR #168 is merged and live. Matthew said yes to all three follow-ups.

**Already in the working tree:**
- `components/Tour/tourLinks.jsx` (`withLinks`): renders `[words](https://…)` as a link that opens in a new tab; http(s) only.
- `TourPanel` takes an opt-in `textLinks` prop, which only `ChurchHistory2App` passes. The link style is in `TourPanel.css`.
- Migration `20261008230000_tour_links_and_john.sql`:
  - scene 2 says "around AD 30–33";
  - Matthew's Irenaeus links come back (scene 5's "Irenaeus", "writes" in scenes 6–8);
  - `CH_People.name` becomes 'John' for `john-evangelist`.
- Snapshot updated to match.
- **Checked safe to rename:**
  - John's works come from `CH_Works` by `person_id` (5 rows), not by name;
  - his Wikipedia text comes from `reference_url` (John_the_Apostle), not by name.

**Remaining:**
1. Unit test `tests/unit/tour-links.test.js`:
   - a link becomes an `<a>`;
   - a non-http address stays as plain text;
   - text with no links comes back unchanged.
2. E2E (real data): scene 5's "Irenaeus" is a link to newadvent, with `target=_blank`; the timeline shows "John".
3. Build, then unit, full e2e (Node 20), and lint on the touched files; a shot of tour scene 5.
4. DESIGN.md §6 Tour row: scene text may carry links (opt-in `textLinks`).
5. Commit, open a PR, watch CI to green, and merge (Matthew already said "yes to all"; merge once green).
6. Tell Matthew it's live once the migration lands.

## Now: merge PR #168 (Matthew: "merge it", then "Merged yet?", 2026-10-08)

The check suite on head c4ec702 completed with nothing failed. Codex's two threads are answered and resolved.

1. Re-read the check runs on c4ec702 and confirm all 5 are green.
2. Merge (merge commit) and unsubscribe.
3. Confirm the migration ran: query `CH_TourScenes` (`title` for `john` and `cappadocians`, `map_from` for `irenaeus-2`) once CI's migrations job has finished.
4. Tell Matthew it's live and what to check (scene 2's paragraphs, scene 7's map, the Key icon).

## M6 tour copy PR: Matthew's edits, the Irenaeus map, scene 1's event, "John" (2026-10-08)

**Context.**
- Matthew has finished editing the tour copy doc (https://claude.ai/code/artifact/f9b9d0f2-dd34-455a-9b13-e9408c23c6e2).
- Comments in the doc ask for:
  - keeping the Irenaeus build-up (scenes 6–8), already answered;
  - adding Jesus's death and resurrection to scene 1;
  - "John the Evangelist" → "John" (thread `cd82469b-df58`, still unanswered).
- New ask: on Irenaeus's map, "start in Smyrna, but when it loads scene 7, the map moves to Lyons". Scene 7 (`irenaeus-2`) is the scene that opens his dialog: its text adds "Irenaeus then becomes a bishop in Gaul". Scene 8 keeps the dialog open.

### 1. Copy into the database (one migration)
- **Compare the doc with the live table.** Read the doc's 20 scenes (title, narrative, additional and third narrative per scene id) and the live `CH_TourScenes` rows (Supabase connector, read-only), then compare field by field.
- **Write the migration**, `supabase/migrations/20261008…_tour_copy_m6.sql`. It updates only the changed fields, `where scene_id = …`, using dollar-quoted strings so apostrophes and quotes stay exact. It includes:
  - "The Cappadocians" (formerly "The Grandchildren");
  - scene 3's title "John";
  - scene 1 `jesus-intro`: `point_ids = '{event-crucifixion}'`.
- **"John" on the timeline too:** `CH_People.name = 'John'` for John's row, so the bar, search and the dialog match the tour. Find his `person_id` first, and check no other figure is named plain "John".
- **Snapshot:** apply the same changes to `tests/e2e/data/lifelines-snapshot.json` (a small script) so shots and e2e use the new copy.
- Show Matthew the field-level diff in the PR body, so he can check every changed line.

### 2. Irenaeus's map travels from Smyrna to Lyons (opt-in)
- **Data:**
  - add `map_from text` to `CH_TourScenes` (nullable) and set `'Smyrna'` on `irenaeus-2`;
  - the adapter (`fetchTourScenes`, `data/churchHistorySupabaseAdapter.js`) maps it to `scene.mapFrom`;
  - other apps never set it.
- **Wiring:**
  - `ChurchHistory2App` passes `detailMapFrom = { personId: scene.openPersonId, location: scene.mapFrom }` while that scene is showing;
  - `Timeline` → `TimelineModal` → `HistoricalMap` get a `fromLocation` prop, given only when the dialog's item is that person.
- **HistoricalMap** (`components/Timeline/components/HistoricalMap.jsx`):
  - With `fromLocation`, the map starts centred on Smyrna with its pin there.
  - About 0.8s after the map loads, it `flyTo`s Lyons over about 2.5s, arcing out and back in, and the pin moves to Lyons.
  - `fromLocation` is read once, through a ref, when the map is created. Scene 8, which keeps the same dialog open, does not rebuild or replay the map.
  - Reduced motion: no flight, it starts at Lyons.
  - Without the prop, nothing changes for any other dialog or app.
- **Coordinates:** both places already exist in `data/locationCoordinates.js` (`Smyrna`, `Lyons, Gaul`).

### 3. Doc replies
In thread `cd82469b-df58`, reply that the scene title and the figure become "John" in this PR. One reply only.

### Verification
- **Unit:** the adapter maps `map_from`.
- **E2E (fixture):**
  - a tour scene with `map_from` shows the map's pin at Smyrna first, then at Lyons;
  - reduced motion starts at Lyons;
  - a normal dialog's map is unchanged.
  - Test it through a `data-map-center` attribute set when the map moves; MapLibre itself can't draw without WebGL in some browsers.
- **Shots:** the tour at scenes 1, 3, 7 and 13 (desktop and phone).
- Unit, full e2e under Node 20, and lint on the touched files.
- Commit, open the PR, and watch it go green. The migration is applied by CI on merge, as before.
- **DESIGN.md §6 Tour row:** a scene may move a figure's map from where they started to where they settled.

## Next step: merge PR #167 (Matthew: "Merge it", 2026-10-08)

[hawkandheron-dev/windhover-site#167](https://github.com/hawkandheron-dev/windhover-site/pull/167) is green on cba7ec6 (check suite completed, no failures), and Codex found nothing.

1. Re-check the check runs on the head and confirm all are green.
2. Merge (merge commit, as with #158–#166).
3. Unsubscribe from the PR.
4. Fast-forward `claude/clever-curie-0627ec` to main.
5. Tell Matthew it's live, and remind him the tour copy doc (https://claude.ai/artifact/XqZP6PXrHoJTorkDuNumAy) is his to edit next.

## Band icons: a portrait for figures, an hourglass for years (2026-10-08)

**Context.** Matthew: church figures' band icon should be "a profile or portrait icon (looks like a person)", and Year's "an hourglass, maybe". Today the band shows the Key's marks: a bar for figures, a line for years.

**Change (Lifelines only, in the band; the Key keeps its marks):**
- **Church figure:** the existing `universal/profile.svg`, a classical bust: a head over the shoulders, on a pedestal line. It's already in the icon set, in the same stroke style as the crown. Add `'profile'` to `iconMap` in `components/Timeline/components/Icon.jsx`.
- **Year:** a new `universal/hourglass.svg` in the set's style (24×24 viewBox, 1.5 stroke, round caps): two bulbs between a top and a bottom bar, with a little sand in the lower bulb.
  - Add it to both identical copies, `icons/universal/` (served at `/icons/`) and `timeline-scratch/public/icons/universal/`.
  - Add an `index.json` entry in both.
  - Add `'hourglass'` to `iconMap`.
- **Wiring:**
  - `detailTypeBand` in `data/churchHistory2Data.js`: `mark: 'profile'` for figures and `mark: 'hourglass'` for years.
  - `DetailTypeBand.jsx`: render `Icon` (white, 15px) for crown, profile and hourglass; `StringMark` for diamond, square and dot.
  - Remove the now-unused `.modal-type-band-bar` / `-line` CSS.
- **DESIGN.md §3 Detail frame:** the band leads with an icon: a portrait for a figure, an hourglass for a year, the crown for a ruler, and the Key's diamond, square or dot for councils, texts and events.

**Verification:**
- Update the e2e band test: the figure band holds the profile icon (`.icon` inside `.modal-type-band-mark`); the year band holds an icon.
- Shots: `detail-ruler`, `panel` and `year`; read the crops of the band at 2×.
- Unit, the full e2e under Node 20, and lint on the touched files.
- Commit, open a PR, watch it go green, and merge when Matthew says.

## Tour copy: how Matthew edits it

The doc already exists: **Lifelines tour copy**, https://claude.ai/artifact/XqZP6PXrHoJTorkDuNumAy (made 2026-10-04, all 20 scenes).
- Matthew edits the text directly in the doc. "The Grandchildren" → "The Cappadocians" goes there too.
- When he's done, he tells me. I read the doc, diff it against `CH_TourScenes`, and write one migration (`supabase/migrations/…_tour_copy.sql`) that updates the changed scenes by `scene_id`. I refresh the snapshot and send screenshots of the changed scenes.
- CI applies the migration on merge.
- First, check that the doc still matches the live rows: scenes may have changed since 2026-10-04. Check with the Supabase connector (read-only).

## Status after the domain switch (2026-10-08, 13:45 UTC)

**Context.** [hawkandheron-dev/windhover-site#165](https://github.com/hawkandheron-dev/windhover-site/pull/165) and [hawkandheron-dev/windhover-site#166](https://github.com/hawkandheron-dev/windhover-site/pull/166) are both merged.

**Domain and keys:**
- windhoverhistory.com and www are attached to the profile-site project; hawkandheronmews.com is being removed.
- Clerk: the production instance's primary domain is windhoverhistory.com, and it is verified.
- Cloudflare: Production uses `pk_live_` and Preview uses `pk_test_`. That's correct; nothing to change.

**Matthew checks on the live site:**
1. `/` and `/lifelines` both show Lifelines.
2. The share preview of `https://windhoverhistory.com/lifelines` shows the card.
3. `/?admin`: sign in and the admin tools appear.
4. Turnstile: windhoverhistory.com is in the widget's Hostnames, and a feedback code arrives.

**Claude:** no code change is planned. The next work waits on Matthew:
- tour copy, including "The Cappadocians" (M6);
- portrait images;
- the controls direction;
- widening the network for the M5 data pass.

## windhoverhistory.com (2026-10-08)

Matthew: point both windhoverhistory.com and windhoverhistory.com/lifelines to Lifelines.

**Code (PR):**
- `_redirects` and `serve.json`: `/lifelines` and `/lifelines/` proxy to Lifelines.
- `_headers`: those two addresses are indexable as well as `/`.
- The canonical link and `og:url` are `https://windhoverhistory.com/lifelines`, and `LIFELINES_SITE_URL` now defaults to windhoverhistory.com.

**Matthew (dashboard):** add `windhoverhistory.com` (and `www`) as custom domains on the `profile-site` Pages project. The domain's DNS must be on Cloudflare for the bare domain. Merge only once it's live, since the share image URL points at the new domain.

## Strip glow on first load, band icons, smoother Full Picture (2026-10-08)

- The strip's slide and glow happen only when the tour brings it in (`arriving` / `rulerArrives`), not behind the welcome dialog.
- Each band leads with its mark in white: bar, diamond, square, dot, crown, line.
- "The Full Picture" (`buildOutWave`, 1.4s): one layout, then one sweep. Measured at 4× slowed CPU: long frames went from 33 (worst 433ms) to 3, and bars moved once instead of 5–7 times.

## Tour copy: queued edits (Matthew)

- Rename the scene "The Grandchildren" to "The Cappadocians" (2026-10-08).
- Scene 1 (`jesus-intro`): add the event `event-crucifixion` ("Crucifixion and Resurrection of Jesus") to `point_ids`. Today the scene shows Jesus only (Matthew, doc comment, 2026-10-08).
- Scenes 6–8 (Irenaeus): keep the paragraph-at-a-time build-up (Matthew, 2026-10-08).
- "John the Evangelist" → "John" (Matthew, doc comment on scene 3, 2026-10-08). He already retitled the scene heading in the doc to "3. John". Still to do:
  - with the tour migration, set the scene title to "John";
  - also rename the figure (`CH_People.name` for the John row) to "John", so the bar, search and popup match the tour;
  - refresh the snapshot;
  - search the 20 scenes' copy for "John the Evangelist" and change any left.
  - **Now:** reply in the doc thread `cd82469b-df58`: the heading already says John, and the figure and scene title will be renamed with the copy edits. Change nothing else in the doc. Apply it with the rest of the tour copy edits (M6): a migration on `CH_TourScenes` plus a snapshot refresh.

## The grow-in's backdrop: no strobe (2026-10-08)

**Context.** Matthew: "The movement of the popup opening is good. But the way the background darkens at the same time gives it a strobe effect." He asks for the darkening to be gentler, and to start once the popup has opened fully.

**Cause.** The whole overlay (`.timeline-modal`) fades in over 0.2s (`modalFadeIn`). That fade includes the backdrop: the dark wash plus a 4px blur. It runs in the same instant as the coloured block's grow (520ms), so the screen dims and blurs sharply while the block is still moving.

**Change** (Lifelines only: while the dialog grows from a bar, `growFrom` / `detailGrowFromBar`):
- `TimelineModal` adds `timeline-modal--grow` to the overlay when it grows.
- In CSS, that class turns off the overlay's own 0.2s fade.
- The backdrop then waits until the grow has finished (about 500ms) and fades in over about 700ms with an ease-out, so the blur and the darkening arrive together, slowly.
- **Reduced motion:** no grow, so the old short fade stays.
- **Unchanged:** dialogs that don't grow, including the other apps and the docked panel.
- **DESIGN.md §6 Tour row:** add one clause: "the backdrop darkens only after the dialog has opened, slowly".

**Verification:**
- Capture frames slowed 12×, as before. While the block grows, the backdrop should still be clear; it darkens after.
- Run the existing grow and reduced-motion e2e tests.
- Add one assertion: during the grow, the backdrop's opacity is still near 0.
- Run unit and lint.
- Push to [hawkandheron-dev/windhover-site#165](https://github.com/hawkandheron-dev/windhover-site/pull/165), which is still open, then watch it go green.

## Titles, emperors strip, grow transition: PR #164 (2026-10-08)

> **Status (03:46 UTC):** [hawkandheron-dev/windhover-site#164](https://github.com/hawkandheron-dev/windhover-site/pull/164) is green on head abefb75: Unit, Build, E2E (Chromium), E2E (Firefox, WebKit), Cloudflare Pages.
> - Codex found nothing on the first commit, and there are no review threads.
> - **Waiting on:** Matthew to try the preview (https://8de481ee.profile-site-bgf.pages.dev), the tour's Irenaeus step and the Emperors tab, then to say merge.
> - **Nothing left for Claude** unless CI or a review changes.

## M9: launch readiness (started 2026-10-05)

> **Status (2026-10-05, 21:58 UTC):** [hawkandheron-dev/windhover-site#163](https://github.com/hawkandheron-dev/windhover-site/pull/163) is open and green on every check: Unit, Build, E2E (Chromium), E2E (Firefox, WebKit), Cloudflare Pages. There are no review threads.
> - **Waiting on:** Matthew's go-ahead to merge (he merged #162 through me; same here once he says so).
> - **After the merge:** he runs the device test script (https://claude.ai/code/artifact/4aaff49e-fa47-421d-a8c1-f953453151b1) and checks the share card on a draft Substack post.

**Context.** M7 step 1 is merged (#162), and Matthew confirmed sources and licensing on his phone. He asked for the three items that need no decisions from him: the share preview, a speed check, and a device test script.

**Done on the branch:**
- **Share card.** `church-history-2.html` gains a description, canonical link, Open Graph and Twitter tags, a 64px tab icon and a 180px home-screen icon. The absolute address comes from `vite.config.js` (`LIFELINES_SITE_URL`, default `https://profile-site-bgf.pages.dev`), so moving to windhoverhistory.com is one line or one Pages variable. The image is `timeline-scratch/public/lifelines-share.png` (1200×630, 190 KB): the real opening view, laid out at 1500×788 and drawn at 0.8×, with the page's controls hidden and the name set in the empty band above the rulers. It is made by `npm run shots -- --share`.
- **Speed** (simulated mid-range phone: 4× CPU, slow 4G, real data replayed): time to a visible timeline went from about 3.6s to 3.0s, and the download from 864 KB to 740 KB. Two fixes:
  - **The Windhover mark** was a 2570×1865, 66 KB PNG, downloaded twice (header and tab icon) to be drawn about 22px tall. It is now 96px tall and 3 KB (`Windhover_BLK-small.png`); the Key, which is shared code, uses it too, and it looks the same at its size.
  - **Clerk no longer loads for readers.** Mounting ClerkProvider fetched Clerk's browser script from Clerk's servers on every visit. Now it loads only for `?admin` or a browser carrying Clerk's `__client_uat` sign-in cookie (`utils/lifelinesAuth.js`, shared by the entry point and the app). The saving can't be measured in the sandbox, since Clerk's servers are blocked.
- **Left alone, with reasons:**
  - The data requests use `select=*` and are about 420 KB uncompressed in the mock; Supabase compresses them in production.
  - `works.js` (51 KB raw) sits in the shared Timeline chunk; lazy-loading it would mean restructuring the shared modal for about 12 KB compressed.
  - The ~650ms of long tasks at 4× CPU is the layout of 183 figures; it doesn't block the first paint.
- **Device test script:** a Claude Doc for Matthew covering iPhone Safari, Android Chrome, desktop Safari and Firefox (about 20 minutes).

**Verification:**
- Unit 197; lint clean in the touched files.
- E2E: share tags absolute, image 1200×630, icons serve, small logo only, readers make no Clerk request while `?admin` does. The ClerkProvider test now loads with `?admin`, the branch that still ships Clerk.
- Shots: header and Key logo at 1x and Retina.
- Data note for M5: William Tyndale has no birth year in the snapshot.

## M7 PR #162: Codex review (2026-10-05)

**Context.** [hawkandheron-dev/windhover-site#162](https://github.com/hawkandheron-dev/windhover-site/pull/162) is open, and its Cloudflare preview deployed. Codex left two P2 comments.

1. **"Restore the Alegreya Sans 600 weight"** (`fonts-local.css:12`). **Doesn't apply:**
   - Alegreya Sans has no 600 face. Both `@fontsource/alegreya-sans` and Google ship 100, 300, 400, 500, 700, 800 and 900.
   - So `font-weight: 600` already resolved to the 700 face before this PR, through Google too. The old `wght@400;500;600;700` request asked for a weight the family doesn't have.
   - Nothing changes visually.
   - **Action:** reply on the thread with this, and resolve it. No code change.
2. **"Clear failed-image state when a retry succeeds"** (`TourPanel.jsx:187`). **Valid:**
   - If a picture fails once, `failedMediaId` stays set for the rest of the tour.
   - Coming back to that scene remounts `TourImage`. If the picture then loads, the credit stays hidden, so a picture would show without its credit.
   - **Fix:** `TourImage` gains an `onLoad` callback. `TourPanel` clears `failedMediaId` when the loaded picture is the one marked failed (`setFailedMediaId(id => (id === media.mediaId ? null : id))`).
   - **Test (e2e, fixture):** the picture's first request fails and later ones succeed. Open the tour: no credit. Go Next, then Back: the picture loads and the credit shows.

**Matthew's answers (2026-10-05):**
- Credit **Matt Brown**. He asks whether a licence is needed at all, since the view, not his copy, is the point.
- Analytics is switched on.
- **Merge to main**; he tests the Sources links on mobile after that.

**Licence wording:** keep CC BY 4.0, but say what it actually covers, which is his own work:
- the selection, dates and connections (the view's data);
- the tour text.

Without a stated licence, the default is "all rights reserved", and nobody could reuse the dataset. The About line becomes: "The timeline's selection of people, dates and connections, and the tour text, are shared under CC BY 4.0: you may reuse them, with credit to Matt Brown." Update ATTRIBUTION.md to match. If he'd rather drop it, it's a one-line removal.

**Then:**
- Run unit, lint on the touched files, build, and the new and existing tour e2e tests under Node 20.
- Reply on both threads (the commit for #2, the explanation for #1) and resolve them.
- Push, and watch CI to green (Chromium, Firefox/WebKit, Cloudflare).
- **Merge** #162 into main once green (Matthew asked), then tell him to test on his phone.

> **Status (17:18 UTC):** done. Head 9804250 is fully green: Unit, Build, E2E (Chromium), E2E (Firefox, WebKit), Cloudflare Pages. Both Codex threads are answered and resolved.
> - **Remaining:** merge #162 (merge commit, as with #158–#161), unsubscribe, cancel the safety-net check-in (trig_01WHtJrDjHCt9hmvS4yGKN1b), and tell Matthew to test "Source" on his phone at the live site.

## M7 step 1: credits, licences, privacy (started 2026-10-05)

**Context.** Matthew's decisions (2026-10-05):
- **Licence:** CC BY 4.0 for his own content and data. Declaring it is all that's needed; others may reuse it with credit.
- **Analytics:** yes to Cloudflare Web Analytics. He switches it on in the dashboard; no code is needed.
- **Domain:** later, windhoverhistory.com/lifelines (a path, not a subdomain). The redirect and canonical URL come in M9, once the domain is pointed.
- **The two descriptions:** he is undecided. Not part of this step; the explanation goes to him in chat.

**Already done on the branch (uncommitted, lint 0):**
- **Fonts:** self-hosted for Lifelines (`fonts-local.css`); the other apps keep Google (`fonts-google.css`).
- **Wikipedia:** a CC BY-SA 4.0 note under the Wikipedia text (`wikiLicenceNote`).
- **Maps:** an "OpenHistoricalMap contributors (ODbL)" line under both maps (`mapCreditLine`).

**What the live data shows for the tour pictures:**
- All 15 say "Public domain, Wikimedia Commons".
- `source_page_url` is unreliable as a credit link. Many point at a Wikipedia article or a Commons category, not the picture's own page.
- `media_url` is always `commons.wikimedia.org/wiki/Special:FilePath/<File>`, so the picture's own Commons page is `commons.wikimedia.org/wiki/File:<File>`.
- Today the credit is a 10px overlay on the picture, and Lifelines hides it on phones.

### Remaining steps
1. **Tour picture credit** (opt-in `tourImageCredit` prop on `TourPanel`, passed only by `ChurchHistory2App`; 1.0 unchanged):
   - Below the picture, show a small caption line: "<attribution> · <a>Source</a>". On phones it sits under the title row.
   - The link goes to the Commons file page derived from `media_url` by a new helper beside `components/Tour/sizedImageUrl.js` (`commonsFilePage(url)`, unit-tested). It falls back to `sourcePageUrl` when the URL isn't a Commons FilePath.
   - Hide the old overlay when the caption is on.
2. **About & credits dialog:**
   - A small "About & credits" link in the slim Key's footer (opt-in `config.aboutLink`, `TimelineLegend.jsx` `SlimLegend`). It opens a dialog built on the existing welcome dialog's pattern: focus trap, Esc, focus returns to the link.
   - **About:** one line, followed by "Lifelines' own text and data are licensed CC BY 4.0", with a link, crediting "Windhover History". Matthew confirms the name to credit and the wording in review.
   - **Credits:**
     - Wikipedia text (CC BY-SA 4.0);
     - maps (OpenHistoricalMap, ODbL; MapLibre, BSD);
     - pictures (Wikimedia Commons, credited on each picture);
     - fonts (Cormorant and Alegreya Sans, SIL OFL).
   - **Privacy:**
     - no cookies and no tracking;
     - fonts are self-hosted;
     - Cloudflare Web Analytics counts visits without cookies;
     - the feedback form sends your message by email (Resend), checked by Cloudflare Turnstile;
     - the timeline data comes from Supabase.
   - This dialog replaces the separate privacy page from the original M7.
3. **Docs:**
   - **ATTRIBUTION.md:** CC BY 4.0 for Lifelines' content; self-hosted fonts; a per-image Commons licence check is still to do.
   - **DESIGN.md §6:** the caption, the Key's About link and the dialog.
   - Sync `docs/lifelines-release-plan.md`.
4. **Deferred:** checking each picture's real licence on Commons needs network access (M5). It's noted in ATTRIBUTION.md.

**Verification:**
- Unit: `commonsFilePage`.
- E2E, with the Lifelines fixture:
  - the Wikipedia licence note shows;
  - the map credit shows;
  - a tour picture's caption links to its Commons file page, and is visible at 390px;
  - the About dialog opens from the Key, closes with Esc, and returns focus.
  - Heresies shows none of these.
- Check that no `fonts.googleapis.com` request comes from Lifelines.
- Build; shots (panel, tour at phone and desktop, the About dialog, dark); `ux-review`; lint 0; full e2e under Node 20.
- Commit, open the M7 PR, and drive CI green (including Firefox and WebKit).

## M4 PR #161: the first Firefox/WebKit run (2026-10-05)

> **Status (2026-10-05, 15:04 UTC):** done. All five checks are green on head 1cfb950: Unit, Build, E2E (Chromium), E2E (Firefox, WebKit), Cloudflare Pages. No review threads. The PR is ready for Matthew to merge; nothing is left for Claude.
> - **Fixed along the way:**
>   - hover follows the real pointer, not the media query;
>   - maps fail softly without WebGL;
>   - the glide back from the tour re-aims when the timeline widens late;
>   - the touch helper dispatches plain touch events;
>   - the Firefox project leaves out the @phone block.
> - **Also:** "Lifelines" in the Key is set in Alegreya Sans (Matthew, 2026-10-05).
> - **Next, after the merge:** wait on Matthew's controls direction, the tour copy and the portrait images; M5 data checks come last, by his call.

**Context.** [hawkandheron-dev/windhover-site#161](https://github.com/hawkandheron-dev/windhover-site/pull/161) is open. Its new **E2E (Firefox, WebKit)** job ran for the first time: 121 passed, 12 failed, 1 flaky. The Chromium jobs are green. Read from the CI log, the failures fall into four groups:

1. **The test tool can't do it in that browser** (harness, not app):
   - **Firefox:** the 4 "Horizontal phone prototype" tests use `isMobile`, which Playwright doesn't support in Firefox.
   - **WebKit:** 2 touch tests (drag, pinch) send touches through Chrome's DevTools protocol (`newCDPSession`), which exists only in Chromium.
2. **Firefox never shows the hover card or the cursor year chip** (4 tests: the hover test, the header-leave test, the batched pinch, the redraw count, which times out waiting).
   - **Likely cause:** headless Firefox on Linux reports `(hover: none)`. Lifelines (`touchGestures`) then treats the mouse as a finger (`noHover()` in Timeline.jsx) and never shows hover.
   - **Real risk:** any desktop that reports `hover: none` (some touch laptops, some Linux setups) would lose hover too.
3. **Firefox: the detail panel's map never finishes loading** (the panel-layout test waits for `.historical-map-container:not([aria-busy])`).
   - **Likely cause:** no WebGL in headless Firefox, so MapLibre fails to start.
   - **Real risk:** a reader without WebGL (an old machine, blocked GPU) gets a broken map area, or worse, an error in the panel.
   - **Also:** the Key-button test in Firefox (the button detaches mid-click) may share a cause with group 2. To confirm.
4. **WebKit: after the tour, the view sometimes glides back to "1–650 AD"** instead of "1–500 AD". It passed on retry. A wrong final view is a real bug, not a flake (the readout held 1–650 for 5s).

**Constraint:** the sandbox has only Chromium, and CLAUDE.md forbids `playwright install`. So every Firefox/WebKit fix is validated by CI. To keep CI cycles few, the first push also makes failures readable.

### Steps (one push, then iterate)
1. **Make the next run diagnosable:**
   - Playwright `reporter` on CI adds `['html', { open: 'never' }]`, so `playwright-report/` exists and is uploaded on failure. Also upload `test-results/`, which holds each failure's `error-context.md` (a page snapshot).
   - Add a small test, `browser capabilities`, run in all projects. It logs `matchMedia('(hover: hover)')`, `(pointer: fine)`, WebGL availability and `devicePixelRatio` to the CI log, so groups 2 and 3 are confirmed rather than guessed. It asserts only that the page loads.
2. **Group 2, hover without the media query** (a real robustness fix, shared but behaviour-preserving):
   - Replace `noHover()` (media query) with "a touch happened in the last ~800ms". Track `touchstart` on the container; a synthesized mouse event follows a touch within that window, a real mouse doesn't.
   - The M3 intent is kept: a tap leaves no cursor line, year chip or hover card.
   - Tests: the existing touch tests in Chromium, plus a new one where a mouse move with no preceding touch shows the year chip even when `matchMedia('(hover: none)')` is forced true (init script).
3. **Group 3, a map that fails gracefully:**
   - `HistoricalMap` and `YearDetailMap` wrap `new maplibregl.Map` in try/catch, and also handle a missing WebGL context (`maplibregl.supported?.()` where available).
   - On failure they show the quiet fallback "Map unavailable in this browser" and clear `aria-busy`, so the panel stays usable and readable.
   - Test: in Chromium, force a failure (an init script that makes `getContext('webgl'/'webgl2')` return null). The panel still opens, shows the fallback, and the description stays above it.
4. **Group 4, WebKit's glide target:**
   - Read `useTourExitWave`/`resetView`: the opening frame is probably computed from a width read mid-layout (tour panel closing) in WebKit.
   - Fix: compute the target after the panel has closed (next frame / ResizeObserver settle), or from the final container width.
   - Test: the existing test, unchanged; it must pass on the first attempt in WebKit in CI.
5. **Group 1, the test tool's limits:**
   - **WebKit touch:** replace the CDP touch helper with in-page `TouchEvent`s (`new Touch`/`new TouchEvent`, dispatched on the canvas). The same helper then works in Chromium and WebKit, so the gestures are tested in Safari's engine. That's the browser phones actually use.
   - **Firefox phone:** Playwright can't emulate a phone in Firefox. The "Horizontal phone prototype" block is excluded from the Firefox project with `grepInvert` on a `@phone` tag, and the config comment says why. This is not skipping a failing test: the tests still run in Chromium and WebKit, and Firefox phones aren't something Playwright can emulate.
6. **Validate locally** what the sandbox can (Chromium: unit, full e2e under Node 20, lint 0, the new tests failing before and passing after where possible). Push once. Read the new CI artifacts and the capability log, and fix anything still red. Repeat until both browser jobs are green. Then report to Matthew.

**DESIGN.md:** §8 gets one line: hover follows the actual pointer, not the media query. Plus the map fallback state.

## M4: code review and cleanup (started 2026-10-05)

**Context.** Matthew: "Start on M4. Data checks and copy will probably be the last thing. Need to get all the mechanics and moving parts clean and ready first." So M4 is about mechanics. No visible design change is intended, apart from sharper canvas text on Retina screens and a friendly error state.

What a read-only survey found:
- **Lint:** 44 problems (26 errors, 18 warnings) across the files Lifelines runs.
  - 11 unused variables;
  - 8 setState-in-effect;
  - 2 ref reads during render (`useZoomPan.js:259`);
  - 2 used-before-declared (`useSmoothPan.js:68`, `EditableText.jsx:124`);
  - 18 exhaustive-deps warnings.
  - The data files are clean.
- **`ChurchHistory2App.jsx` has two near-copies.** `AuthenticatedApp` and `UnauthenticatedApp` duplicate:
  - the search handlers (470–480 and 648–658);
  - the header (527–569 and 662–704, differing only in the right slot);
  - loading/error/timeline (571–596 and 705–727);
  - the welcome dialog (598–605 and 729–736);
  - the hook setup.
- **Error state:** a raw `Error: {err.message}` in an inline style; loading is a plain grey div. Neither has a role or a retry.
- **Dead code:** `data/churchHistory2Eras.js`, imported only by its own test; `Timeline.jsx:915` `handleBlankClick`; two outdated comments.
- **Blurry canvas:** no `devicePixelRatio` anywhere. The canvases render at CSS size (`TimelineCanvas.jsx:665`), and `DepthLayers` has two of them. Hit-testing is in CSS pixels, so `ctx.scale(dpr)` keeps it correct.
- **Mousemove:**
  - `setMousePos({x,y})` re-renders all of Timeline on every move;
  - `handleItemHover` depends on `mousePos`;
  - `setHoveredItem` gets a new object every move;
  - `hoveredItem` is in the canvas draw effect's dependencies, so hovering a figure redraws both canvases on every mouse move.
- **CI:** chromium only; Node 20.
- **E2E gaps:** the feedback dialog has no test at all (the gate doc's top outstanding item); the Lifelines legend filtering isn't tested; welcome Skip is used but never asserted.

### Steps (one branch, small commits, one PR; render with shots after any visible change)
1. **Lint to zero** in the Lifelines files above. These are behaviour-preserving fixes only:
   - remove unused variables and the dead `handleBlankClick`;
   - reorder declarations that are used before they're declared;
   - replace the ref read in `useZoomPan` with state, or drop it from the return if nobody reads it;
   - setState-in-effect: change each to derived state, an event handler, or a lazy initial state, case by case. Where an effect genuinely syncs from outside (`useMobileDetect`'s `matchMedia`), use `useSyncExternalStore`;
   - exhaustive-deps: add the real dependencies, or stabilise them with `useCallback`/`useMemo`/refs. Never silence one with a disable comment unless it's justified in a line.
   - These files are shared, so each fix must leave the other apps unchanged. Verify with the full e2e suite and the other-apps screenshot diff (as in M3).
2. **`ChurchHistory2App.jsx`:** one `LifelinesShell` component. It renders the header, body and welcome dialog, takes the right-hand header slot and the extra timeline props as props, and is used by both Auth and Unauth. One `useSearchHandlers(timelineRef)` hook. Hook setup is shared through a single `useLifelinesData()`.
3. **Loading and error states** (DESIGN §8: every data area has loading/empty/error):
   - **Loading:** a `role="status"` line in ink-faded type with the same text.
   - **Error:** a `role="alert"` panel: "Lifelines couldn't load the timeline. Check your connection and try again." with a Retry button (`.btn`) that re-runs the fetch. The raw message goes to the console, not the page.
   - Add a shots state `error` (data mock returns 500) and an e2e test: the error shows, Retry works once the mock recovers.
4. **Dead code:**
   - delete `churchHistory2Eras.js` and `tests/unit/church-history-2-eras.test.js`; the commit says why, per CLAUDE.md rule 5: the module has no live caller;
   - fix the two outdated comments.
5. **Sharp canvas on Retina:**
   - In `TimelineCanvas`, set the backing store to `width × dpr` / `height × dpr`, set CSS size to width/height, and `ctx.setTransform(dpr,0,0,dpr,0,0)` before drawing.
   - Re-run when `devicePixelRatio` changes (a `matchMedia('(resolution: …)')` listener).
   - Opt-in through `config.hiDpiCanvas` (Lifelines on) per CLAUDE.md rule 2. Other apps can turn it on later with one line.
   - Shots at `deviceScaleFactor: 2` to compare before and after; hit-tests unchanged (existing hover and click tests).
6. **No re-render on every mouse move:**
   - Keep the pointer position in a ref.
   - Move the cursor line and year chip into a small `CursorGuide` child that owns its own state, so only it re-renders.
   - `setHoveredItem` only when the hovered item's id changes. The hover card's position goes through a ref/CSS variable.
   - The canvas draw effect depends on the hovered id, not the object.
   - Behaviour is identical, in shared code, and invisible.
   - Verify with the existing hover/cursor tests, plus a Playwright check that 50 mouse moves over one figure cause ≤ 2 canvas redraws (count via a `data-draws` debug attribute behind `?debug`, or a performance mark).
7. **E2E coverage:**
   - **Feedback dialog:** both flows, gated (stored token, captcha condition) and ungated, mocking `/api/feedback`. Read `FeedbackButton.jsx` and `functions/api/feedback.js` first, and mirror the conditions the gate doc lists.
   - **Legend toggles on Lifelines:** unchecking Councils removes the council strings and labels; re-checking restores them. The same for Emperors and the rulers strip.
   - **Welcome dialog:** Skip closes it and focus goes where §8 says.
8. **Firefox and WebKit in CI:**
   - Add the `firefox` and `webkit` projects in `playwright.config.js`, scoped by `testMatch` to the Lifelines spec, so CI time stays reasonable.
   - In CI, install with `npx playwright install --with-deps chromium firefox webkit`.
   - The sandbox only has Chromium (and CLAUDE.md forbids `playwright install`), so these two only run in CI. Expect a round or two of fixes on the PR. Each real browser difference is fixed in code; a test that relies on Chromium-only behaviour is reworked, never skipped (CLAUDE.md rule 5).
9. **Code review:**
   - run `/code-review` at high effort over the M4 diff;
   - fix what it finds;
   - then `ux-review` on the shots, since states and canvas sharpness are visible changes.

**Verification (each commit, and before the PR)**
- `npm run test:unit`; `npm run build`; the full e2e under Node 20 (`npx -y node@20 node_modules/@playwright/test/cli.js test`, as CI runs).
- Lint is zero errors and zero warnings in the Lifelines file list.
- Shots read, including the new `error` state.
- Other apps: compare screenshots against `main` built in a worktree (pixel-identical expected; HiDPI is opt-in).
- One PR (M4) with the usual body; watch it to green, including the new Firefox and WebKit jobs.

## After M3 (merged 2026-10-05): what's next

**Context.** M3 ([hawkandheron-dev/windhover-site#160](https://github.com/hawkandheron-dev/windhover-site/pull/160)) is merged. Matthew's latest decisions:
- **Key:** stays open by default on wide screens. The DESIGN.md Known violations line becomes an accepted rule.
- **Placeholder portraits:** no mock-ups; he'll find or make his own. The plan step shrinks to wiring in his images when they arrive.
- **Bottom-left controls:** he'll rework them after his own research. He asked for a research piece comparing navigation options: done as a Claude Doc, https://claude.ai/code/artifact/a804ab62-0287-41a3-a27d-f3a19571a83e (recommends a docked bar now and an overview strip later).
- "What's next?"

**Housekeeping first.** Restart `claude/clever-curie-0627ec` from the merged `main` (`git fetch origin main && git checkout -B claude/clever-curie-0627ec origin/main`, then a force-with-lease push). The branch holds only merged history, so nothing is lost. The sandbox's safety check blocked this command once, so Matthew will see a permission prompt.

### 1. Navigation research (for Matthew)
A page comparing how comparable tools handle pan and zoom controls, written as a Claude Doc so he can comment on it. A Claude Doc is a document he can comment on directly.
- **Tools compared** (6–8):
  - timelines: TimelineJS, Histography, Our World in Data's time slider, Kronoscope/Timeline Index;
  - maps: Google Maps, Apple Maps, Mapbox/MapLibre defaults;
  - design tools: Figma's canvas.
- **For each tool:** where the controls sit, what they are (zoom ±, reset, a range slider or minimap, a scale or years readout), how they behave on phone versus desktop, and whether they cover the content.
- **Patterns** distilled from these, with trade-offs for Lifelines (examples: a slim bar docked above the rulers strip, an overview "minimap" of AD 1–1500 that you drag, gesture-only on touch with a single reset button, controls folded into the header).
- **Fit with our constraints:** DESIGN.md §6 and §8, 44px phone targets, keyboard access, and not covering figures.
- **Recommendation:** two or three directions. I'll make no code changes.
- **Sources:** web search, cited inline. The sandbox can't screenshot live sites (network policy), so the doc describes them and links to them.

### 2. Small doc commit
- **DESIGN.md:** move the "Key covers figures on wide screens" line from Known violations into §6 as the owner's decision (open by default at 1100px and up).
- **This plan:** drop the portrait mock-up step (Matthew supplies the images); keep the wiring (linked media, the panel slot) for when they arrive.
- Sync `docs/lifelines-release-plan.md`.
- Commit and push; no PR until there's code.

### 3. Then: M4, code review and cleanup (Claude-only, no decisions needed)
This is already in the plan:
- `/code-review` at high effort on the Lifelines files.
- Lint to zero in those files.
- Merge the duplicated header, search and loading/error blocks in `ChurchHistory2App.jsx`.
- Remove dead code (`churchHistory2Eras.js`).
- HiDPI canvas scaling, which makes it sharp on Retina.
- Stop the re-render on every mouse move.
- A friendly error with a Retry button.
- E2E for the feedback dialog and the legend toggles.
- Firefox and WebKit in CI.
- It ships as one PR, with the usual checks.

**Waiting on Matthew** (no action from me until then): tour copy edits in the doc; portrait images; the controls direction after the research; M5 needs full network access for the data work (dates, links, citations).

## M3 PR #160: CI red and two bot findings (2026-10-05)

**Context.** Matthew subscribed this session to [hawkandheron-dev/windhover-site#160](https://github.com/hawkandheron-dev/windhover-site/pull/160). Three items are open on it:
- **E2E failed in CI.** One test fails twice: "no figure label runs into the next one in its row (real data)" (`tests/e2e/church-history-2.spec.js:848`), with `TypeError: Map.groupBy is not a function`. CI runs Node 20, which lacks `Map.groupBy` (Node 21+), and the sandbox's newer Node hid it. The cause is in the test, not the app. The other 65 tests pass in CI, including the three auth smoke tests that only fail in the sandbox.
- **Codex P2 on `scripts/lifelines-shots.mjs:85`:** `--compare points` still switches on `?points=strings`, which nothing reads any more since strings became the config default, so both arms render strings. The prototype is retired.
- **Codex P2 on `Timeline.jsx:63-68`:** the vertical layout gets only `data`, never `backData`, so choosing Vertical drops every emperor and monarch while the Key still offers an "Emperors & monarchs" switch. This was already true on phones before M3 (vertical was the only phone layout); the toggle makes it reachable on desktop too.

**Steps**
1. **Fix the test:** replace `Map.groupBy` with a plain grouping (a `Map` filled in a loop), no change to what it asserts. Reproduce the failure first by running that test under Node 20 (`npx -y node@20`), then show it passing.
2. **Retire `--compare points`:** delete `POINT_STYLES`/`COMPARE_POINTS` and the `points` option; update the script's usage comment. Reply on the thread with the commit and resolve it.
3. **Rulers in the vertical layout:** Matthew picked (2026-10-05) a **rulers column pinned to the right edge**, the vertical twin of the bottom strip:
   - about 90px wide, sticky right, white with a left rule;
   - thin vertical reign bars packed into up to three sub-columns, each with a small crown and the name, cut with "…" at the next reign (reuse `packRulerRows` logic, rotated);
   - tap opens the ruler; the Emperors switch hides it;
   - opt-in via `rulerStyle: 'strip'` passed to `MobileTimeline` with `backData`, so other apps are unchanged.
   - Tests: e2e that the vertical layout shows Constantine in the column and the Key switch hides it; ruler names don't overlap.
   - Shots: default--phone, vertical--tablet/desktop.
   - DESIGN.md §6: rulers sit in a strip at the foot (horizontal) or a column at the right edge (vertical).
4. **Push once**, after unit, build, full e2e, lint and shots are clean. Reply on both Codex threads with the commit, resolve them, and update the PR body's Checks section.

## M3 round 6c: the tour's detail on phones (2026-10-04)

**Context.** Some tour steps open a figure's detail (step 7 opens Irenaeus). On a phone that detail is the full centred modal, with a large map, and it covers the whole timeline and half the tour sheet.

Matthew: "I think it's just a shorter panel on mobile, maybe with no images."

**Change** (Lifelines only; phones, ≤768px; only while the tour is running):
- The detail the tour opens becomes a **short card** in the top part of the screen, above the tour sheet:
  - at most about 40% of the height, scrolling inside;
  - the timeline stays visible between the card and the sheet.
- It shows the name, dates, place and description. It drops the map and other pictures (and, later, portraits), along with the long works and sources list, which stays one tap away through "open full details" in the card.
- **How:**
  - `TimelineModal` gains an opt-in `variant="brief"`. It hides the map block and the works/sources section and adds a "More" link that switches to the full layout. Other apps never pass it.
  - The tour passes it on phones: `MobileTimeline` and the horizontal phone layout open the modal with `brief` when `isTourMode` is set.
  - Lifelines CSS places the brief card at the top, with `max-height: 40%` and a white surface (DESIGN §4).
- Outside the tour, a tapped figure still opens the full detail.

**Verification**
- E2E at 390×844, in the vertical and horizontal layouts:
  - a tour step that opens a figure shows the brief card with no map, at most 45% of the height and above the sheet;
  - "More" opens the full detail;
  - a figure tapped outside the tour still opens the full modal with its map.
- Shots: the phone tour state (`tour-later`) before and after.
- DESIGN.md §6 Tour row: on phones a step's figure detail is a brief card.

## M3 round 6b: strip default, no title ring, apply the migration (2026-10-04)

**Context.** Matthew:
- "Rulers across the bottom is *excellent*." Make the strip the default.
- When a person or ruler opens, their name in the panel shows a blue box. That's the focus ring on the panel title, which takes focus for keyboard and screen-reader users (DESIGN §8). Remove the box.
- "Apply migration for councils and events."
- The mobile-tour question (skip auto-opening panels on phones) is undecided; leave it.

**State:** done but not yet committed. 47 of 49 Lifelines e2e tests passed on the last run.
- **Strip as default:** `rulerStyle: 'strip'` in config, and the `?rulers=strip` switch and `--compare rulers` are gone.
- **Quiet band removed:** its code is gone (depth override, `backClearsFrontPoints`, `utils/rulerDrop.js` and its test, the monarch-label CSS), and `DepthLayers` is back to its pre-round-4 form.
- **Panel title:** `outline: none` on `#timeline-detail-title:focus`. It isn't a control; focus still lands there.
- **100 BC:** `minYear: -100`, honoured by `Timeline.jsx` (`defaultConfig.minYear ?? derivedMinYear`) and `MobileTimeline` `dataBounds`.
- **Tests:** strip default; 100 BC floor; the title has focus but no ring; the panel test checks strip focus (Constantius II).

**Steps**
1. **Fix the 2 failing e2e tests** (from the last run: "expected > 21, got 1" and "expected < 79.5, got 159"). Find which tests they are and whether the strip changed the geometry they measure, e.g. the controls moved up or the canvas height shrank. Fix the cause, or update the test where the decision changed, saying why. Never loosen a test.
2. **DONE 2026-10-04.** Applied and verified on the live project:
   - councils: 7 major, 12 minor (still active, hidden by the app);
   - events: 16 major (active), 9 minor (inactive);
   - documents: 43 major.
   
   (Original step:) **Apply the migration** `20261004120000_ch_event_significance.sql` to the live project (`fnxsfdbbnjbveyjmwanc`), as Matthew asked. Run the file's SQL as written (`execute_sql`): it's idempotent, so the CI workflow re-running it on merge is a no-op, as with the M1 active flags. Then verify with read-only queries:
   - `significance` exists;
   - 7 shown councils, 16 shown events, and texts unchanged;
   - the two new Constantinople rows are present.
3. **Run the checks:** full unit + e2e suites, lint compared with HEAD on the touched files, and shots (desktop, laptop, phone, dark). Read the strip and the panel title.
4. **DESIGN.md:**
   - §3 Reigns row: the strip is the treatment, the quiet band was retired;
   - §6: the timeline starts at 100 BC;
   - §8: the panel title takes focus without a ring.
5. **Commit and push:** round 6 in one commit, with the reasons and the migration note. Sync `docs/lifelines-release-plan.md`.
6. **Report to Matthew:**
   - the migration is applied, with counts;
   - the tour copy doc is ready (link);
   - the sign-in explanation (Clerk on `*.pages.dev`, or a Preview env var);
   - the still-open mobile tour question.

## M3 round 6: start at 100 BC; tour copy doc (2026-10-04)

**Context.** Matthew:
- "Start the whole thing at 100 BC; we don't need anything earlier... lots of white space."
- He tried signing in to edit the tour copy and couldn't.

**Findings.**
- **Pan floor:** the timeline lets readers pan to `data minimum − max(10% of span, 200 years)` (`Timeline.jsx` `derivedMinYear`). The earliest record is Augustus, born 63 BC, so the floor is about 263 BC. The vertical phone timeline pads its own bounds similarly (`MobileTimeline` `dataBounds`).
- **Tour copy:** Lifelines has no tour-text editing at all, signed in or not, merged or not. The copy lives in `CH_TourScenes`; signing in only unlocks the picture-crop control.
- **His answer:** edit the copy in a **shared doc** (M6, brought forward).
- **Sign-in itself:** it probably fails on the preview because of the Clerk setup:
  - a production Clerk key only accepts its own domain, not `*.pages.dev`;
  - or Cloudflare Pages has no `CLERK_PUBLISHABLE_KEY` for the Preview environment, since Pages variables are set per environment.

  Neither needs code. I'll explain both and Matthew checks; it only matters for the admin tools (notes, suggestions, picture crop).

**Steps**
1. **100 BC floor** (Lifelines config `minYear: -100`, opt-in):
   - `Timeline.jsx`: `minYear = defaultConfig.minYear ?? derivedMinYear`, passed to `useZoomPan` (`clampStart` already enforces it).
   - `MobileTimeline`: clamp `dataBounds.minYear` to `config.minYear` when set.
   - The opening view (1–500 AD) is unchanged.
   - E2E: panning far left stops with the readout starting at 100 BC; phone: scrolling to the top shows 100 BC.
   - DESIGN §6 "Opening view" row: the timeline starts at 100 BC.
2. **Tour copy doc:** a Claude Doc with all 20 scenes from `CH_TourScenes`. Each scene gets its number, the title, the narrative and any additional or third narrative lines, plus which figures it shows, for context.
   - Matthew edits it.
   - I then write one migration updating `CH_TourScenes` and send screenshots.
   - The doc's scene ids keep his edits matched to the rows.

## Added to the plan (2026-10-04): placeholder portraits

> **Update 2026-10-05:** Matthew will find or make the placeholder images himself; no mock-ups from Claude (step 3's style options are dropped). The data and wiring steps stand for when his images arrive.

> **Matthew's direction (2026-10-05):** placeholders come from public-domain period portraits on Wikimedia Commons, for example the Sepphoris mosaic known as the "Mona Lisa of the Galilee". Each is put through a filter that makes it plain the picture is *not* the person in the entry (for instance a soft monochrome wash or a faded duotone, plus "Illustrative portrait" in the alt text and a small caption).
> - **Matthew:** adds reference images to this list as he finds them.
> - **When wiring:**
>   - store each placeholder's Commons file page and licence with it (M7 per-image credit);
>   - pick by sex and, where possible, by period and region (a late-antique Roman face for a 4th-century bishop, not a Renaissance one);
>   - apply the filter in CSS, so the original stays untouched and the treatment can change in one place;
>   - the panel says "Illustrative portrait (not a likeness)", so no reader takes it for the figure.
> - **Reference images so far:**
>   - "Mona Lisa of the Galilee", Sepphoris mosaic (Commons; file to be confirmed).

**Context.** Matthew: "we need a good placeholder portrait for male and female people who don't have images."

**What the code shows today:**
- Lifelines shows no portraits anywhere.
- `CH_People` has no image field and no sex field.
- The only images are tour pictures, which come from `CH_LinkedMedia` with `entity_type 'tour_scene'`.

So this needs three things: somewhere for real portraits to come from, a placeholder when there is none, and a way to choose the male or female placeholder.

**Steps (a new M3 step, after the open picks; it touches data, so the migration rides the same PR):**
1. **Where portraits come from.** Reuse `CH_LinkedMedia` with `entity_type 'person'`, the same table and `fetchLinkedMedia` path the tour uses, so no new table is needed. Run the URL through `sizedImageUrl` (thumbnails) as for the tour.
2. **Male or female.** A migration adds `sex text check (sex in ('male','female'))` to `CH_People`.
   - I prefill it from the data: names and roles (pope, bishop and emperor are male; abbess, empress and saints like Monica and Macrina are female), so each figure starts with a best guess.
   - I give Matthew a short list to confirm: the women, plus any figure I'm unsure of.
   - Unknown falls back to a neutral placeholder.
3. **The placeholders.** Two (plus a neutral one) hand-drawn inline SVGs in Lifelines' style, not stock silhouettes.
   - **Style:** a quiet bust in the ink tokens on a soft ground, matching the white UI and the Cormorant/Alegreya feel (DESIGN §4). Late-antique dress cues: a cloak and pallium for men, a veil or palla for women. No halo, so the placeholders don't make sanctity claims.
   - **Sizing:** the same circle or rounded square as a real portrait, so the layout never changes when a real image arrives.
   - **Marking:** a placeholder is visibly a placeholder (lighter tone) and has empty alt text; the person's name is already beside it.
   - **Review:** I'll render 2–3 style options as an Artifact for Matthew to pick from before wiring them in.
4. **Where portraits show:** the detail panel header beside the name, search results (small), and the hover card. The vertical phone cards stay text-only unless Matthew wants them there.
5. **DESIGN.md:** a rule for portraits and placeholders (size, shape, the placeholder tone, the alt text). Add the sex field to the M5 data checklist.

**Verification:**
- Unit: the placeholder choice (male, female, unknown).
- E2E: a figure with linked media shows its portrait; one without shows the right placeholder at the same size.
- Shots: the panel and search on desktop and phone, in light and dark.

## M3 round 5: major events, seven councils, string hover (2026-10-04)

**Context.**
- **Roomy:** Matthew: "Roomy doesn't work." Remove the prototype.
- **Noise:**
  - Split events into major and minor. Show the major ones and hide the minor ones for now.
  - Show only the seven ecumenical councils.
  - Keep the texts.
- **String hover:**
  - The line grows 200% wider and turns a brighter gold.
  - It comes forward, over every person.
  - It highlights the people connected to it.

**His answers.**
- **Major events (16):** his list plus the Decian Persecution.
  - Crucifixion & Resurrection; Pentecost; Great Fire of Rome; Destruction of the Temple
  - Decian Persecution; Great Persecution; Edict of Milan; Edict of Thessalonica
  - Rome sacked by the Visigoths; End of the Western Roman Empire; Coronation of Charlemagne
  - East/West Schism; First Crusade; Gutenberg's printing press; Fall of Constantinople; Luther at the Diet of Worms
- **Minor events (9, hidden):**
  - Hagia Sophia; Iconoclasm; Normans; Investiture Controversy; Hussite Wars
  - Spanish Inquisition; Peace of Augsburg; Mayflower; Revocation of the Edict of Nantes
- **Councils:**
  - Major: Nicaea I, Constantinople I, Ephesus, Chalcedon, Nicaea II.
  - **Add** Constantinople II (553) and Constantinople III (680–681).
  - The other 12 councils (Jerusalem, Arles, Antioch ×2, Serdica, Ariminum/Seleucia, Alexandria, Carthage, Ephesus II, Whitby, Frankfurt, Trent) become minor and hidden. They are not deleted.

### Steps

**A. Data: one migration** (`supabase/migrations/2026100412xxxx_ch_event_significance.sql`; CI applies it on merge).
- Add `significance text not null default 'major' check (significance in ('major','minor'))` to `CH_Events`. Texts stay major.
- Set the 9 minor events and 12 minor councils to minor, by `event_id`.
- Set `active = true` on the 16 major events, which are hidden today (DESIGN §9 "plain events" removed; the owner is bringing the major ones back).
- Insert the two councils:
  - **Constantinople II:** 553, Constantinople. Condemned the Three Chapters.
  - **Constantinople III:** 680–681, Constantinople. Condemned Monothelitism.
  - Each with a one-line description and a Wikipedia `reference_url`, for Matthew to review in the PR. Citations come in M5.
- Refresh `tests/e2e/data/lifelines-snapshot.json` with the same changes, via a small script that applies them to the JSON. The sandbox can't write to Supabase.

**B. Adapter and config** (Lifelines only).
- `churchHistory2Adapter.js`:
  - Drop rows where `significance === 'minor'`, treating a missing value as major so old snapshots still load.
  - Plain events (`event_type 'event'`) already have a style (`POINT_STYLES.events`, filter key `events`). They sit above the axis with the councils.
  - Their mark is a **dot** (`markForPoint`), while councils are diamonds and texts are squares.
- Legend: add an "Events" row with the dot mark (`filterKey: 'events'`); make sure the filter defaults on.
- DESIGN.md:
  - §9: plain events are no longer "removed". Major events show; minor events are hidden.
  - §3: the events colour paired with the dot mark.

**C. String hover.**
- The hovered line goes from 1px to 3px (+200%) in a brighter gold. Add a new `--color-string-hover` value, brighter than `#c08f12` (e.g. `#e3a92b`) while still reading on white at 3px. It stays in the overlay at z 12, above every person bar and label. Dots and label follow the same gold.
- **Connected people highlighted:** while a string is hovered, each linked figure's bar (`point.connectedPeople`, front layer) gets a gold outline ring drawn in the overlay (bars' screen rects are already computed there), and its name label gets a gold edge.
  - It's overlay-only, so no Timeline state is needed.
  - Rulers linked to the event are skipped for now: there are 4 such links, and they're on another layer.

**D. Remove the roomy prototype.**
- Remove `?density=roomy`, `stringDotLabels`, the dot labels, `personBarHeight` and `--compare density`, along with its e2e test. Git keeps them.

**Verification**
- Unit: an adapter test that minor rows are dropped and a missing significance counts as major.
- E2E:
  - **Fixture:** add a major event, a minor event and a minor council.
  - **Visibility:** the major event shows with a dot, the minor ones don't, and the "Events" Key row toggles it.
  - **Hover:**
    - the hovered string is 3px and the new gold;
    - Athanasius's and Eusebius's bars get rings when Nicaea is hovered;
    - the rings go on mouse leave.
  - **Real data:** exactly 7 councils render across the full span.
- Shots: the defaults, read on desktop, laptop and phone.
- Unit and e2e pass, and lint is unchanged.

## M3 round 4: rulers lower, full labels, compact vs roomy (2026-10-03)

**Context.** Matthew's notes on round 3:
1. **Monarchs need to move down.** In the quiet band the first ruler row sits right under the axis, in the same row as the texts' labels ("Galatians" over "Nero", "Shepherd of Hermas" over "Commodus").
2. **Labels go back to full names.** "Truncated labels is weird, I take it back. Labels shouldn't change when we hover on them."
3. **New:** "a compact vs. roomy view, where events and texts that show up in between people could have a small label and enough vertical margin for them to show."

### Steps (same branch; render with shots after each)

**A. Rulers below the texts' row.**
- In `Timeline.jsx`, measure the front layout's below-axis band: the deepest below-axis landmark row (`stackedPoints` with `aboveTimeline === false`) under the axis, plus about 10px of air.
- Behind the opt-in config `backClearsFrontPoints: true` (Lifelines), pass that height to `DepthLayers` as an extra `yOffset` (the canvas, the focus layer and `MonarchLabels` all share it). Pass it to the overlay's `backObstacles` too, so the texts' dots still avoid the rulers.
- The rulers then start under the texts' labels, clear of them, at every zoom. Other apps are unchanged.
- The `?rulers=strip` prototype is unaffected.

**B. Full names, no hover swap.**
- Labels show `point.name` at rest and on hover; the hover only lifts the label (the shadow) and turns its string gold.
- Remove `utils/shortLabel.js`, its unit test, `config.shortLabels` and the adapter's `shortName`. Git keeps them if short labels return.
- The collision pass measures the full names again (as in round 2).
- DESIGN.md §7: drop the short-label rule and say labels never change on hover.

**C. Compact vs roomy prototype** (`?density=roomy`; compact stays the default until Matthew picks).
- **Roomy** opens a margin under each figure's bar, so the strings' dots among the people can carry a small label:
  - People rows grow from 34px to about 52px (bar unchanged, a gap of about 20px under it), via the Lifelines `layoutSizes` when `density === 'roomy'`.
  - Each dot among the people (a linked dot on a bar's lower edge, or an open-space dot in a gap) gets a small label beside it, in the gap under the bar. It's 11px, ink-light, with the string's mark, giving the landmark's full name.
  - One in-context label per landmark: on the dot nearest the axis.
  - A greedy per-gap collision pass drops a label that would hit another label or a bar; the dot stays and still hovers and opens.
- **Compact** is today's layout (no labels among the people).
- **Implementation:**
  - A `stringDotLabels: true` option in `TimelineOverlay.renderPointStrings`, and a `labelRect` per placed dot from `placeStringDots`. The open-space search in roomy mode prefers the gaps, which are now taller.
  - The density comes from a URL parameter read in `ChurchHistory2App` (like `?rulers=strip`).
- **Comparison:** `--compare density` in the shots script renders compact vs roomy at the opening view, zoomed in and with Athanasius selected, on desktop and laptop. Send it to Matthew and stop for his pick. If roomy wins, it can become the default or a reader toggle beside Layout.

**Verification**
- Unit:
  - `placeStringDots` returns label rects that never overlap a bar or each other.
  - The ruler offset helper (pure function for the below-band height).
- E2E:
  - On real data, no ruler label overlaps a text label (bounding boxes).
  - A string label reads the same before and during hover.
  - With `?density=roomy`:
    - people rows are taller;
    - Nicaea's dot on Athanasius carries a "Council of Nicaea" label, which doesn't overlap any figure label.
- Shots: the defaults plus `--compare density` and `--compare rulers`, read in light and dark.
- Unit and e2e pass; lint unchanged; the other apps unchanged.

## M3 round 3: harp strings, rulers, zoom (Matthew's feedback, 2026-10-03)

**Context.** Matthew used round 2 on his PC.
- **What he liked:**
  - Dots where a string meets its related people.
  - One line of councils above the axis and one of texts below, which keeps the focus on people.
- **What he asked for:**
  - **Markers:** texts become small squares, other events stay dots, councils become diamonds, all the same size.
  - **Labels:** short at rest ("Didache"), the full name on hover.
  - **Strings:** behind every entry, with a hovered string brought to the front.
  - **Dots:** one on every related person a string crosses.
- **Problems he reported:**
  - The rulers' band is cluttered, and the blur doesn't read as anything.
  - The exit sweep felt no different. When the tour is finished, its last scene has already shown everyone, so there's nothing left to sweep.
  - After a trackpad pinch over the header zoomed the page, he couldn't scroll back up out of the timeline.
  - He asked whether it should be "Lyons" or "Lyon".
- **His answers:**
  - Councils go to the place only ("Nicaea").
  - Rulers: try "crisp and quiet" (the default) and "a strip pinned to the bottom" behind a URL parameter.
  - Tour exit: glide plus sweep, always.

**Irenaeus:** keep **"Irenaeus of Lyons"**.
- It's the established English name for the saint, for example in John Behr's *Irenaeus of Lyons* (OUP, 2013) and the Catholic Encyclopedia. "Lyon" is the city's modern official name.
- The data is already consistent: his name is "Irenaeus of Lyons" and his location "Lyons, Gaul". Only Michael VIII's note mentions the 1274 "Council of Lyon", which is that council's usual modern name.
- So nothing changes. I'll recheck it against Wikipedia and Britannica in M5's date pass, once the network is widened.

### Steps (same branch; render with shots after each)

**A. Marker shapes.**
- Councils get a diamond, texts a square and anything else a dot, all 9px with a 2px white rim.
- The dots, the label icons and the legend rows (Lifelines config `shape`) use the same marks, so the Key matches the canvas. `ShapeIcon` gets `square`/`diamond` if they're missing.
- Gold hover keeps the shape.
- The dots drop their native `title`, which duplicated the hover card (his screenshot).

**B. Short labels.**
- `utils/shortLabel.js` derives the resting label from the name:
  - **Councils:** the place, with ordinals as numerals ("Ephesus II", "Constantinople I"). Parentheticals are dropped ("Antioch").
  - **Texts:**
    - Drop "X writes / delivers / compiles / completes / posts" and trailing "composed / written / completed / mentioned / published", plus a leading "The".
    - "Paul's letter to the Galatians" → "Galatians"; "First epistle of Clement" → "1 Clement"; papyri → "P42", "P46".
- A config map of overrides covers anything the rules get wrong. Later, a `short_name` column (M5) can override in the data.
- A unit test pins all 60 current names to their short forms; I'll show Matthew that table.
- Hovering a label grows it to the full name, in front of its neighbours; the collision pass uses the short widths.

**C. Strings behind entries.**
- The resting lines move onto the front canvas, drawn before the bars, so every bar and name sits on top.
  - Same colours and opacities, including focus.
  - Behind `pointStyle: 'string'`, so other apps are untouched.
- The overlay keeps only the hit strips, labels and dots.
- The hovered or focused string is drawn again in the overlay, gold and 2px, above everything.

**D. A dot on every related person.**
- `placeStringDots` returns a list per landmark: one dot on each linked figure alive that year (on their bar's lower edge), or one open-space dot if there are none.
- The unit tests are extended to cover several dots per landmark.

**E. Rulers, two prototypes** (`?rulers=strip` switches; the default is quiet).
- **Quiet (default):**
  - No blur.
  - Thin pale bars and small grey names, under the strings.
  - The text dots' open-space search treats ruler rows as obstacles, so dots stop landing in the ruler names.
  - Hovering or choosing a figure darkens their ruler(s) instead of un-blurring them.
- **Strip (`?rulers=strip`):**
  - A compact band pinned to the bottom of the timeline: rows of about 14px, at most 5 rows, panning horizontally with the axis but not vertically.
  - Below the axis, only the texts' line remains.
  - The controls sit above the strip. Rulers in the strip still hover and open.
- Matthew compares the two on the preview and picks. Shots render both (`--compare rulers`).
- DESIGN.md §3/§6 record the background as reigns only, with the chosen treatment.

**F. Tour exit: glide plus sweep, always.**
- On every exit (Exit, Skip, Esc, Finish), the viewport glides about 1s from the tour's last frame to the opening view, and the people the tour wasn't showing sweep in during it.
- Finish after the build-out still glides.
- This uses the imperative `animateViewport` the tour already uses, with the opening frame as the target (exposed from Timeline as `resetView({ animate })`).
- Reduced motion jumps straight there.

**G. Trackpad and browser zoom.**
- Over the timeline, a trackpad pinch (Chrome, Edge and Firefox send it as a ctrl+wheel; Safari as `gesture*` events) zooms the timeline, not the page.
- If the page is already zoomed by the browser (`visualViewport.scale > 1`), the timeline stops capturing the scroll wheel, so the reader can always scroll back out to the header and zoom out.
- Browser zoom stays available everywhere else, for accessibility.
- E2E: a ctrl+wheel zooms the readout; a plain wheel while visually zoomed isn't swallowed.

**H. Then:** step 6 (the vertical phone: card overlap, white toolbar, zoom into empty BC), `ux-review`, and the M3 PR.

**Verification:**
- Unit: `shortLabel` (all 60 names), `placeStringDots` with multiple dots.
- E2E:
  - the shapes per kind;
  - a short label that expands on hover;
  - a string under a bar (`elementFromPoint` on a bar crossing returns the canvas or bar, not the string);
  - a hovered string on top;
  - multiple dots on the Nicaea fixture (add a second linked person);
  - glide on Finish;
  - pinch zoom;
  - the visual-zoom scroll passthrough;
  - `?rulers=strip` renders the strip.
- Shots: the defaults plus `--compare rulers`, read in light and dark.
- Lint unchanged, and the other apps unchanged.

## M3 round 2: Matthew's feedback on the prototypes (2026-10-03)

**Context.** Matthew tried the M3 branch on his PC and phone.
- **What he reported:** the page loads slowly, element by element. Tour images paint "bar by bar". Coming out of the tour, the full timeline appears with a jarring jump.
- **What he picked:**
  - **Harp strings** win, and should be hoverable and clickable. Their dots should sit on related people.
  - **Phone:** both layouts work. Vertical is the phone default, horizontal the desktop default, and readers can switch between them.
  - The **Rulers** control goes.
  - The **tour** on phones becomes a bottom panel.
  - The phone's scroll area must clear iOS Safari's address bar.
  - The legend **subtitle** is no longer italic.
- **His answers:**
  - Tour exit: **sweep in**.
  - Dots for events with no linked person go **in open space**, never on a bar.

What the code shows (two read-only investigations):
- **Load:**
  - A blocking `<script src="/api/supabase-config">` holds up React.
  - maplibre (1 MB raw, 277 KB gzip) loads eagerly, although only modals use it.
  - Google Fonts load through CSS `@import` chains.
  - Tour scenes are fetched only after all 10 tables, then linked media after that, so it's a waterfall.
  - Tour images are full-resolution Wikimedia originals (`Special:FilePath/…` with no `?width=`). That is the "dial-up" effect.
- **Strings:** the line has `pointer-events: none`, so only the label or the axis dot is a target. The canvas also keeps an invisible 120×20 hit box per point (`TimelineCanvas.jsx:428`).
- **Links:** points carry `connectedPeople` (from `CH_EventConnections`). 32 of the 60 active points have at least one person, 4 of those links go to monarchs, and the overlay already gets `layout.stackedPeople` with each person's y.
- **Tour exit:** the data swaps instantly. The canvas already has a 1200ms bar-grow animation driven by `animatingIds`.

### Steps (same branch and PR as M3; render with shots after each)

**A. Load speed**
1. **Tour images:** in TourPanel, rewrite `Special:FilePath` URLs to `?width=` sized for the panel (×2 for Retina). Add `decoding="async"`, the aspect-ratio box and a fade-in on load. Preload the next scene's image. This is a client-side rewrite in a helper, so no data migration is needed.
2. **Parallel fetches:** fetch tour scenes in the same `Promise.all` as the tables (`ChurchHistory2App.jsx:670`). Also stop `useTour` fetching linked media twice: wait for the real scene ids.
3. **Lazy maps:** `React.lazy` for `HistoricalMap` and `YearDetailMap`. maplibre and its CSS then load only when a detail opens, with a fixed-size placeholder meanwhile. This is shared code, but a pure load change with no visible difference, and it helps every app (called out in the commit).
4. **Config script:** make `/api/supabase-config` non-blocking for Lifelines (`defer`, read the globals at mount). It is only needed for the Supabase URL and the Clerk key, both read after mount.
5. **Fonts:** replace the CSS `@import` with `<link rel="preconnect">` plus `<link rel="stylesheet">` in `church-history-2.html`. The self-hosting decision stays in M7.
6. **Measure:** record bundle sizes before and after, and the request waterfall in Playwright (blocked domains stubbed), in the commit. The real-world check is Matthew reloading the preview on his PC.

**B. Legend subtitle:** remove the italic on `.timeline-legend--slim .legend-site-subtitle` (Lifelines only). Update DESIGN.md §2 if it describes it.

**C. Harp strings become the default** (`pointStyle: 'string'` in Lifelines config; remove `?points=strings`)
1. **Hover and click on the string itself:** give each string an invisible ~9px-wide hit strip (`pointer-events: auto`) over the full height. On hover the line turns gold and goes to 2px, the label lifts, and the cursor is a pointer. Clicking opens the event modal or panel through the existing `onItemClick('point', …)`.
   - New token `--color-string-hover` (gold) on `.ch2-app`, added to DESIGN.md §3 as a hover-only highlight colour.
   - Strings sit under bars and labels (z-order), so a person bar still wins where they cross.
   - Drop the 120px phantom canvas hit box when `pointStyle` is 'string'.
2. **Dots on related people:**
   - **Linked events:** for each point, take the `connectedPeople` that are in `layout.stackedPeople` and alive at the point's year. Place the dot on that person's bar at the point's x, choosing the bar nearest the axis if there are several. The other people are linked by the focus highlight as now.
   - **Monarch links** (4) and **links to people not alive then:** use the open-space rule.
   - **Unlinked events (open-space rule):** at the point's x, find the vertical gaps between bars in the people band (from `stackedPeople` rows covering that year) and the empty band between the people and the axis. Place the dot in the gap nearest the axis that isn't already holding a dot within 14px; if there's none, fall back to the axis.
   - Texts below the axis use the same rule against the space below the axis (rulers are faint background, so their area counts as open).
   - This is a pure function, `placeStringDots(points, stackedPeople, viewport…)` in `utils/stringDots.js`, with unit tests: linked → on the person's row; unlinked → never inside a bar; no two dots within 14px; deterministic.
   - Dots stay clickable and hoverable, with the same gold hover as their string.
3. **Labels** stay as they are (greedy per side).

**D. Tour exit sweep**
- When the tour closes, the figures and points the tour wasn't showing grow in from left to right. Reuse the canvas bar-grow by passing their ids as `animatingIds`/`animatingPointIds`, with a per-item delay based on screen x (a ~900ms wave). Labels and strings fade in behind it (an opacity transition keyed on the same set).
- The ids are computed in `ChurchHistory2App` from `tour.tourData` against `frontData` at exit.
- **Reduced motion:** the canvas grow loop checks `prefers-reduced-motion` and draws final frames at once (today it ignores the preference).
- This also applies to the welcome dialog's "Skip", which goes straight to the full timeline, so it arrives the same way.

**E. Controls and layout toggle**
1. **Remove the Rulers control:** set `depthControl: false` in the Lifelines config so the control isn't rendered. Lifelines stays on "Faint", and hovering or focusing a figure still lifts their ruler. The other apps keep their depth control.
2. **Layout toggle "Vertical / Horizontal"** where the Rulers control was: a two-button segmented control using the existing `.depth-controls` styling, renamed.
   - **Defaults:** vertical below 768px, horizontal above.
   - **Shown on phones and tablets only** (under 1100px). On a wide desktop, the vertical layout would be a very long single column; Matthew can say if he wants it there too.
   - **Remembered:** the choice is stored per device in localStorage under its own key.
   - **Where it lives:** in the vertical layout's toolbar and in the horizontal layout's controls.
   - This replaces the `?mobile=horizontal` prototype switch.
3. **iOS address bar:** size the app with `100dvh` (falling back to `100vh`) instead of `100vh`, and add `padding-bottom: env(safe-area-inset-bottom)` to the bottom controls and toolbar. Check at 390×844 with a simulated shorter visual viewport.

**F. Tour as a bottom sheet on phones**
- Below 768px, `TourPanel` docks to the bottom: full width, at most ~45% of the height, with its own scroll and the image above the text. The timeline keeps the top part and frames the scene's figures within it (pass the sheet height as a bottom inset to the tour's viewport framing).
- Lifelines-only CSS and config (`tourPanelPlacement: 'bottom-on-phone'`).

**G. DESIGN.md and step 6**
- **DESIGN.md:**
  - §3: the gold string hover.
  - §6:
    - Controls: no Rulers control; the Layout toggle and its defaults.
    - Phone layout: vertical by default, switchable.
    - Tour: a bottom sheet on phones.
    - Legend: the subtitle is upright.
  - §7: dot placement.
  - §8: the tour-exit motion and reduced motion.
- **Step 6 (vertical phone fixes) comes back**, because vertical stays the phone default:
  - card stacking (#4);
  - white toolbar (#11);
  - the zoom-into-empty-BC bug, found in the comparison.

**Verification**
- Unit: `stringDots` placement rules, and the image URL rewrite.
- E2E:
  - string hover turns gold and click opens the event;
  - a linked dot sits within its person's bar;
  - no unlinked dot sits inside a bar (real data);
  - the layout toggle switches and is remembered;
  - the Rulers control is absent on Lifelines but present on Heresies;
  - after skipping the tour, all figures are present within 1.5s.
- Shots: the default set, plus the tour exit mid-sweep (a new state) and the phone tour sheet. Run `ux-review`. The other-apps diff shows Heresies and 1.0 unchanged apart from lazy maps.
- Matthew re-checks the load on his PC and the scroll area on an iPhone using the preview.

## M3 implementation: UI/UX review round

**Context.** M1 and M2 are merged (M2 is #159). This milestone is the collaborative design pass. The review used the 16 screenshots from the last `npm run shots` run against the real dataset (Lifelines' code equals `main`), plus DESIGN.md. Matthew decided the four design questions on 2026-10-03 (below). Everything is Lifelines-only behind config or props; the other five apps stay identical (CLAUDE.md rule 2).

**Matthew's decisions**
1. **Legend:** a slim panel that collapses. The colour key goes (century ramp and swatches). Lifelines and its strapline sit at the top; "Windhover / Get a bird's eye view" sits at the bottom. The four show/hide checkboxes stay; councils and texts keep their shape icons. The panel collapses to a small "Key" button when the detail panel opens or the screen is narrow, so it never covers figures.
2. **Events:** prototype harp strings behind `pointStyle: 'string'`, then show flags vs strings side by side at three zoom levels. Matthew picks.
3. **Background rulers:** keep the faded default, but fix the ghosting. The control is relabelled "Rulers: Hide / Faint / Clear".
4. **Keyboard access:** search is the accessible route. Add a skip link to search; Esc closes the panel and returns focus; the panel content is fully keyboard-usable. Recorded as a DESIGN.md §8 decision.

**Findings** (severity on Nielsen's 0–4 scale; evidence is in `.shots/lifelines/`)

| # | Sev | Finding | Evidence | Fix |
|---|---|---|---|---|
| 1 | 3 | Legend covers figures at the right edge, and floats mid-canvas when the panel opens; on tablet it covers about a quarter of the view | `default--tablet`, `panel--laptop` | Decision 1 |
| 2 | 3 | Event cards form a staircase that dominates the view, hides axis labels on laptop, and pushes figures off screen | `default--laptop`, `default--tablet` | Decision 2 |
| 3 | 3 | Names cut mid-word or overlapped by the next bar: "lement of Rome" under Jesus's label, "Thomas Bradwar", "Sylvester II / Gerbert of A" | `default--desktop`, `default--tablet` | When a label won't fit, show the name without dates; if it still won't fit, end it with "…". Never let a neighbouring bar cover a label (draw labels above bars) |
| 4 | 3 | Phone: landmark cards overlap each other and cover the figure bars ("Paul's letter to the Galatians" hidden under "Council of Jerusalem") | `default--phone` | Stack the phone cards so they don't collide (reuse `stackPoints`), and make them opaque white with a border |
| 5 | 2 | Background ghosting: blurred duplicate ruler names behind the crisp labels ("Septimius Severus" twice) | `default--desktop` | Decision 3: don't draw ruler names on the blurred canvas layer when the crisp label layer is on (opt-in config) |
| 6 | 2 | Depth control "Off / Soft / Front" is jargon | all desktop shots | Decision 3 wording |
| 7 | 2 | A hover card is left in the top-left corner ("Rome") after the pointer leaves the canvas into the header | `default--desktop`, `panel--desktop` | Clear the hover state when the pointer leaves the canvas |
| 8 | 2 | Cursor year chip ("250 AD") sits at the very top and overlaps the header | `default--laptop`, `default--tablet` | Place it just below the header (`--ch2-header-height`) |
| 9 | 2 | Detail panel: a large map dominates an event's panel; an all-caps "HISTORICAL MAP" label; "Related People" names don't look clickable | `panel--desktop`, `panel--laptop` | Smaller map below the description; sentence-case headings; related people as links |
| 10 | 2 | Search labels results "EVENT" in red, while the legend says "Councils" / "Texts & creeds"; red is the error colour (DESIGN §3) | `search--desktop`, `search--phone` | Label results Council / Text / Person in neutral ink, with the shape icon |
| 11 | 2 | Phone timeline still uses parchment: beige toolbar and dark brown-grey year gutter (existing known violation) | `default--phone` | White toolbar, light gutter with ink-faded year labels |
| 12 | 2 | Ruler labels below the axis are about 9–10px and truncated ("Caligula 37–") | `default--desktop` | 11px minimum; the same truncation rule as #3 |
| 13 | 2 | No keyboard route to figures (canvas) | `keyboard-focus--desktop` | Decision 4 |
| 14 | 1 | Phone date format "1 AD – 66 AD" vs desktop "1–66" | `default--phone` | Use `formatYearSpan` on phone |
| 15 | 1 | Search ranks "Athanasian canon" above "Athanasius" | `search--desktop` | Rank people above events on equal matches |
| — | 0 | Welcome dialog (desktop and phone), the dark-mode parity and the readout are all fine | `first-visit--*`, `default-dark--*` | — |

Error and loading states (raw "Error: …", plain "Loading…") stay in M4 as planned.

**Order of work** (one PR, small commits; render after each)
1. **Bug fixes (#7, #8, #14, #15):** quick and low-risk.
2. **Legend rework (decision 1, #1):**
   - New opt-in props on `TimelineLegend.jsx`: brand order, no ramp, collapsible.
   - Lifelines config changes in `data/churchHistory2Data.js` (drop the `century-ramp` and swatch rows).
   - Collapse logic: in `ChurchHistory2App.jsx`, collapse when a panel is open or the width is under 1100px.
   - Update DESIGN.md §2, §3 and §6, and the e2e spec "legend shows a century ramp…" with the reason.
3. **Labels and density (#3, #12):**
   - The label-fitting rule goes in `TimelineOverlay.jsx`, behind config `labelFit: 'truncate'`.
   - Rulers: change `MonarchLabels.jsx` and its CSS.
4. **Background (decision 3, #5, #6):**
   - Suppress the canvas ruler labels in `DepthLayers.jsx` / `rendering.js` behind config.
   - New labels for the `DEPTH_MODES` in `Timeline.jsx` via config, so the other apps keep theirs.
5. **Detail panel and search (#9, #10):**
   - `TimelineModal.jsx` gets an opt-in `panelLayout: 'compact'`.
   - `TimelineSearch.jsx` gets opt-in type labels.
6. **Phone (#4, #11), now gated on step 9:** `MobileTimeline.jsx` stacking and white styling, scoped under `.ch2-app`. This runs only if Matthew keeps the vertical phone layout after the step 9 comparison; otherwise it's dropped.
7. **Keyboard (decision 4, #13):**
   - Skip link to search; Esc and focus return in the panel.
   - Add the decision to DESIGN.md §8.
8. **Harp strings prototype (decision 2):**
   - Build it behind `pointStyle: 'string'`. It plugs into `TimelineOverlay.renderPointCallouts` and the layout sizes, reusing `yearToPixel` and the canvas hit map (narrow hit box).
   - The focus set brightens the selected person's strings.
   - Add a `--compare` option to `scripts/lifelines-shots.mjs` that renders flags vs strings at three zoom levels.
   - Send Matthew the comparison and stop for his pick before making either the default.
9. **Horizontal phone prototype** (Matthew's request, 2026-10-03). Phones get the same horizontal timeline as desktop, with the detail opening as a modal instead of the side panel. Done before step 6, since its outcome decides whether step 6 happens.
   - **How:** a Lifelines config key `mobileLayout: 'horizontal'`. When it's set, `Timeline.jsx` renders `DesktopTimeline` below 768px instead of `MobileTimeline`, with `detailVariant: 'modal'` (that variant already exists). The other apps keep the vertical phone layout.
   - **Phone-specific work it needs:**
     - touch drag to pan and pinch to zoom on the canvas. Checked: `DesktopTimeline` has no touch or pointer handlers at all today, so these are new. Use pointer events on the container, feeding the existing `startPan`/`updatePan`/`endPan` and `handleZoom` in `useZoomPan` (anchored on the pinch midpoint). Tap opens items through the existing hit map. This is the bulk of the prototype's cost;
     - the slim, collapsed legend from step 2;
     - controls sized for touch (44px), and the year readout;
     - a smaller label and flag density at phone widths (or harp strings, if chosen in step 8);
     - the opening view framed on the measured width (the M1 fit), at a span that suits 390px.
   - **Comparison:** a `--compare-mobile` option in `scripts/lifelines-shots.mjs` renders vertical vs horizontal at 390×844 and 430×932, at the opening view, zoomed in, and with a detail open. Send these to Matthew, then stop for his pick.
   - **If horizontal wins:** make it the Lifelines default, and update DESIGN.md §6 (the phone layout, and the detail as a modal on phones). The vertical-layout fixes in step 6 are dropped; `MobileTimeline` stays for the other apps.

**Verification**
- After each step:
  - Build, then run `npm run shots`, then read the affected PNGs, including dark mode and phone.
  - Run `ux-review` on the result.
  - Delete the fixed lines from DESIGN.md "Known violations".
- Unit and e2e tests pass (with `CHROMIUM_PATH`). New e2e covers:
  - the legend collapsing when the panel opens
  - no duplicate ruler names
  - the hover card cleared on leaving the canvas
  - Esc closing the panel and returning focus
  - the skip link
- The other apps are unchanged: the before/after screenshot diff from M1, run on the 1.0 and Heresies pages.
- Lint introduces no new findings in the touched files.

---

## M2 implementation: site root goes straight to Lifelines

**Context.** Readers should land on Lifelines at the site root. Every other page should keep working at its own URL but not be advertised or indexed. Today `/` is the "Windhover History" landing page, and nothing redirects anywhere.

**What Cloudflare's docs confirm** (checked with the Cloudflare docs connector):
- `_redirects` supports a `200` proxy rule. The browser keeps showing `/` while it receives another page's content, and `?admin` stays in the address bar where the page reads it.
- `_redirects` does not apply to routes handled by Pages Functions. Ours are `/api/*` only, so `/` is unaffected.
- `_headers` can remove a header added by a broader rule (`! Header-Name`).
- With a `404.html` present, Pages serves it for unknown paths. Without one, and with an `index.html`, Pages treats the site as a single-page app and shows the homepage for every unknown URL. That is today's behaviour.

**Steps** (branch `claude/clever-curie-0627ec`, restarted from merged `main`)
1. **Absolute asset paths.** Change `timeline-scratch/vite.config.js` from `base: './'` to `base: '/apps/'`. Built pages then load `/apps/assets/…`, which works whether the HTML is served at `/apps/church-history-2` or at `/`. All apps already live under `/apps/`, so nothing else moves. I'll confirm with a build that every `apps/*.html` references `/apps/assets/`.
2. **Serve Lifelines at `/`.** Add a root `_redirects` with `/  /apps/church-history-2  200`. The target is the clean URL because Pages redirects `.html` to it, and proxying to a redirect is fragile.
3. **Move the old homepage.** `git mv index.html home.html`, so no static file competes with the rule for `/`. Repoint the "Home" links:
   - **Static pages:** `about.html`, `design-system.html`, `pantheons.html`, `church-history-supabase.html` point to `home.html`.
   - **The other apps:** the hard-coded links in `SiteNavPanel.jsx` (its `NAV_ITEMS` "Home"), `ChurchHistorySupabaseApp.jsx`, `ContributorPortalApp.jsx`, `HistoricalErasApp.jsx`, `BiblicalPlacesApp.jsx`, `BiblicalPlacesSearch.jsx` (default) and `JourneyOverlayControl.jsx` point to `/home.html`.
   - **Lifelines** has no home link since M1.
4. **Keep everything else out of search.** In `_headers`, add `X-Robots-Tag: noindex` to `/*`, then remove it for `/` with `! X-Robots-Tag`. Only the front page is indexable. The direct `/apps/church-history-2` URL is noindexed too, so Lifelines has one indexed address. Existing cache and security rules stay.
5. **`robots.txt`** allows everything, so crawlers can see the noindex headers; a disallow would hide them. The sitemap and canonical URL wait for the domain decision (M9).
6. **`404.html`** at the root: a small static page in Lifelines' look (white ground, Cormorant and Alegreya Sans, ink tokens) saying the page wasn't found, with one link to Lifelines at `/`. This also stops unknown URLs silently showing the old homepage.
7. **Local parity for tests.** Add `serve.json` with the same rewrite (`/` → `/apps/church-history-2`), so the local test server behaves like Pages. A unit test (`tests/unit/site-routing.test.js`) checks that:
   - `_redirects` and `serve.json` agree;
   - `/` is the only path stripped of noindex in `_headers`;
   - `404.html` exists;
   - no root `index.html` remains.
8. **Update tests that encoded the old homepage at `/`** (CLAUDE.md rule 5: changed because the decision changed):
   - `tests/e2e/smoke.spec.js` auth-bootstrap specs: `goto('/')` → `goto('/home.html')`.
   - The landing-nav integrity spec reads `home.html`.
   - New spec: `/` renders Lifelines (welcome dialog says "Welcome to Lifelines"), and `/?admin` shows the account slot.
   - `tests/README.md` updated to match.
9. **Docs.** Record the routing in `README.md` and `docs/REPO_MAP.md`: front page, hidden pages, and how to add an app without it being indexed. Add a DESIGN.md §6 line: Lifelines is served at `/`, and admin uses `/?admin`.

**Verification**
- Locally:
  - `npm run build`; grep confirms `/apps/assets/` in every `apps/*.html`.
  - Unit tests and e2e (with `CHROMIUM_PATH`), including the new routing specs. The smoke auth specs still fail only from the sandbox's blocked CDN.
  - `npm run shots` to check that Lifelines still renders identically at `/apps/church-history-2.html`.
- **Preview deploy:** the sandbox can't reach `*.pages.dev` (checked just now), so Matthew opens the PR's Cloudflare preview URL and checks:
  1. `/` shows Lifelines.
  2. `/?admin` shows "Sign In".
  3. `/home.html` shows the old homepage.
  4. `/apps/heresies` still works.
  5. `/nope` shows the new 404 page.

  Response headers (noindex on everything except `/`) can be checked the same way, or by me once the network is widened.
- Rollback if anything misbehaves in production: delete `_redirects` and redeploy, or promote the previous Pages deployment.

---

## Context

Lifelines (`timeline-scratch/src/ChurchHistory2App.jsx`, `/apps/church-history-2.html`) is close to release. The owner listed eight chunks of pre-launch work (UI/UX, code, copy, site simplification, data, licensing, possible additions, loose ends). This plan puts them in order, says who owns each (**C** = Claude, **M** = Matthew, **C+M** = together), and records the decisions already made. Every UI change follows CLAUDE.md: work from DESIGN.md, render with `npm run shots`, run `ux-review`, then tests.

**Decisions made**
- Open on the early church, with the welcome dialog offering the tour.
- The zoom readout shows a year range instead of "1.6x".
- Citations go in the **Sources section** (`CH_Sources` + `CH_Source_Figures`), not in descriptions.
- Network: Matthew widens this environment to Full access for the data work.
- The old homepage moves to a hidden URL (`/home.html`, noindex).
- Sign-in is **hidden** on public Lifelines at launch.

**Facts that shape the plan** (from research)
- The "opens at AD 750" and "1.6x" problems have one root cause. `Timeline.jsx:124-126` computes the opening view from the placeholder width of 800px on first render, and `useZoomPan` keeps that value. Lifelines also has no `initialCenterYear`, so it falls back to the shared default of AD 1000.
- Vite builds with `base: './'`, so the asset paths are relative. A plain rewrite of `/` to the Lifelines page would break them.
- Of the 160 active figures, 142 have no description of their own. There are about 994 links in the data, 573 of them to Wikipedia. 39 figures were alive in the 4th century.
- The site has no privacy page, no share or social tags, no robots.txt or 404 page, and no analytics.
- Supabase is on the **free plan**: no backups, and the project pauses when idle.
- Lint finds 27 errors and 18 warnings across the files Lifelines runs.
- Other code findings:
  - The three header blocks in `ChurchHistory2App.jsx` are duplicated.
  - Focusing a person never highlights their landmarks: `focusSet` has no visible effect on points.
  - The canvas isn't scaled for HiDPI screens, so it's blurry on Retina.
  - Every collapsed pin has a phantom 120px click area.
  - Five year formatters disagree about BC years.

---

## Milestone 1: Fix what's already decided (C)

Everything here is behind config keys, so the other five apps stay unchanged.

1. **Opening view.**
   - Compute the initial viewport once the container has been measured (`Timeline.jsx`, `useZoomPan.js`).
   - Add `initialCenterYear` to `churchHistory2Data.js`, with the window framed on AD 1–500.
   - On mobile, check the start scroll position in `MobileTimeline.jsx:153`.
2. **Zoom readout.**
   - Add a `formatYear(year, eraLabels)` helper in `utils/dateUtils.js` and use it for all five existing formatters. This fixes the BC off-by-one.
   - Use `getVisibleYearRange` (`coordinates.js:85`, which is currently unused) to show "AD 300 – 700" on desktop (`Timeline.jsx:992`). Make the matching change on mobile (`MobileTimeline.jsx:307`).
3. **Welcome dialog.**
   - Give the dialog a title prop and pass "Welcome to Lifelines". The body copy is Matthew's in M6.
   - Use a Lifelines-specific tour key. The current key is shared with 1.0 (`useTour.js:13`), so anyone who saw the 1.0 tour never gets the welcome.
4. **DESIGN.md known violations:**
   - dark mode: neutralise the shared `.btn` dark overrides under `.ch2-app`
   - action-blue contrast: darken the token on `.ch2-app` to around `#3f63d0`
   - `prefers-reduced-motion` support
   - accessible names on the legend checkboxes
   - stray hex colours folded into tokens
5. **Hide sign-in on Lifelines.**
   - Add a config flag. The header shows search, Tour and Feedback only.
   - Admin and editing stay reachable through a direct URL, e.g. `?admin`, or through the other apps. Settle the exact route while building.
6. **Remove the site navigation from Lifelines.** Drop the menu toggle, the logo's home link and the Contributor Portal link (`ChurchHistory2App.jsx:37-49, 161, 421-425`).

## Milestone 2: Site simplification (C, plus one preview check by M)

- Set Vite `base: '/apps/'` so asset paths are absolute.
- Add a Pages `_redirects` rule that serves Lifelines at `/`, and check it on a **preview deploy**. If Pages' pretty-URL handling interferes, fall back to a 302 redirect to `/apps/church-history-2`.
- Move `index.html` to `home.html` with noindex.
- Add `robots.txt`, which disallows the other apps, and noindex on their HTML entries.
- Add a simple `404.html` in Lifelines' style.
- Update `tests/e2e/smoke.spec.js` (it reads the root landing-nav at lines 31-87) to test the new behaviour. This changes a test because a decision changed, which CLAUDE.md rule 5 allows if the commit says so.

## Milestone 3: UI/UX review round (C+M)

1. I run `ux-review` on the full shot set and publish an **Artifact** of findings, with screenshots, severities and proposed fixes. You mark each finding fix, keep or later.
2. Expected topics:
   - The legend covers figures, and floats over the canvas beside the open panel.
   - Labels are cut mid-word.
   - Landmark cards overlap on phone.
   - The phone header takes about a quarter of the screen.
   - Error and loading states.
   - Panel hierarchy.
3. **Legend rework** (Matthew's direction, 2026-10-03):
   - **Remove the colour key.** Drop the century ramp strip and the colour swatches. The bars' colours stay on the timeline; they just aren't explained in a key.
   - **Swap the brand order.** Top of the panel: **Lifelines / A church history timeline by lifespans**. Bottom: **Windhover / Get a bird's eye view** (new strapline for the publisher mark).
   - **Open questions for the review round:**
     - Do the remaining filter rows (Church figures, Councils, Texts & creeds, Emperors & monarchs) stay as checkboxes without swatches, or move elsewhere? Councils and texts keep their shape icons, since DESIGN.md §3 pairs colour with shape.
     - Does the slimmer panel still need to float over the canvas? This ties to the known violation that the legend covers figures.
   - **Implementation:**
     - Lifelines-only via config: `churchHistory2Data.js` `legend` drops the `century-ramp` row and the colour boxes. The brand block order is a new opt-in prop on `TimelineLegend.jsx`, so the other apps' legends are unchanged.
     - Update DESIGN.md §3 (the century ramp is no longer shown in a key), §6 (legend contents) and §2 (adds the Windhover strapline).
     - Update the e2e spec "legend shows a century ramp…" with the reason (CLAUDE.md rule 5).
4. **Harp strings (7A).** Prototype behind `config.pointStyle: 'string'`:
   - **What changes:** each landmark becomes a thin full-height line at its year, with a small label near the axis. The stacking rows go, which frees vertical space.
   - **How it's built:** it plugs into `TimelineOverlay.renderPointCallouts` (or `TimelineCanvas.renderPoints`) and the layout sizes. It reuses `yearToPixel` and the canvas hit map, with a narrow hit box so strings don't take hover from the bars they cross.
   - **Bonus:** the focus set can brighten a focused person's strings, which fixes the dead highlighting.
   - **Decision:** I'll show you side-by-side screenshots of flags and strings at three zoom levels, and you pick.
5. Fix what you mark, iterating on the screenshots. Fixes go through `frontend-craft`.

## Milestone 4: Code review and cleanup (C)

- Run `/code-review` at high effort on the files Lifelines executes.
- Lint to zero in Lifelines files.
- Merge the duplicated headers, search handlers, and loading/error blocks in `ChurchHistory2App.jsx`.
- Remove dead code: `churchHistory2Eras.js` and its test (say why in the commit), plus unused variables.
- Add HiDPI canvas scaling. This is a visible win.
- Fix the phantom 120px pin hit box.
- Stop the re-render on every mouse move (`Timeline.jsx:410`, and `hoveredItem` in the canvas effect).
- Replace the raw "Error:" with a friendly error and a Retry button.
- Add e2e coverage for:
  - the opening view and readout
  - the feedback dialog (gated and ungated; outstanding item 1 in `docs/lifelines-feedback-gate.md`)
  - landmark click
  - legend toggles
  - the welcome dialog and skip
- Add Firefox and WebKit to the CI Playwright projects.

## Milestone 5: Data (C prepares, M decides)

Needs: Full network access in the environment. Every database write goes through a reviewed migration in `supabase/migrations/` (applied by CI on merge), so each change is auditable and reversible. **Take a backup first.**

1. **Backup:** do a full data export before any edit, and keep it outside Supabase.
2. **4th-century pare-down:**
   - I publish an Artifact checklist of the 39 figures alive in the 300s. For each one it shows connections, tour appearances, works, a Wikipedia pageview rank and a lifespan sketch. You tick who goes inactive.
   - I write the `active = false` migration.
   - The adapter already drops their dangling links, so no other cleanup is needed.
3. **Link check** (about 994 URLs): a reusable script, `scripts/check-links.mjs`. The report sorts links into:
   - broken
   - redirected (I can auto-fix the canonical ones in a migration)
   - Wikipedia article title doesn't match the person (catches wrong-article links)
   - **needs a human**: paywalls, Google Books, timeouts
4. **Date verification:**
   - For all active people (160 figures and 66 monarchs, including reign years), compare our birth and death years with Wikidata (P569/P570, which carry their own references), the Wikipedia infobox, and Britannica where they disagree.
   - Each person is classed as agrees, agrees as "c." / approximate, or **disagrees** (flagged for you).
   - The same goes for city or region of residence.
5. **Citations:**
   - Add one `CH_Sources` row per figure, e.g. "Birth & death years — Britannica", with its URL and a note of which facts it supports (birth, death, residence).
   - Link it through `CH_Source_Figures`. It appears under Works & Sources.
   - This also closes outstanding item 3 in the gate doc: `CH_Sources` has no updater.
6. Refresh `tests/e2e/data/lifelines-snapshot.json` afterwards.

## Milestone 6: Copy (M, supported by C)

- I export every reader-facing string into one editable doc: the 20 tour scenes from `CH_TourScenes`, welcome, feedback, empty and error states, legend, about and credits.
- You edit. I apply your edits (a migration for the tour, code for UI strings), re-render the tour scene by scene, and send you screenshots.

## Milestone 7: Licensing and attribution (C drafts, M approves)

- **Wikipedia:**
  - Add a CC BY-SA 4.0 notice and link beside "From Wikipedia" (`TimelineModal.jsx:641-661`).
  - Excerpts are short and attributed, but the license link is required.
- **OpenHistoricalMap:**
  - Confirm the credit (ODbL data, CC BY-SA cartography) is visible at every size, including in the phone modal.
  - Mention OHM in the credits.
- **Tour images (15):**
  - The data currently says "Public domain, Wikimedia Commons" for every image. I check each image's actual license on Commons.
  - Show per-image credit with a link, because `sourcePageUrl` is stored but never rendered (`TourPanel.jsx:90-92`).
- **Credits and about:** add a small "About & credits" dialog reachable from Lifelines, because `about.html#credits` is unreachable once the site navigation goes.
- **Privacy:**
  - Add a short privacy page covering feedback emails (Resend, HMAC-only storage), Cloudflare and Turnstile, and Supabase.
  - Self-host the fonts (the `@fontsource` packages are already installed), which removes Google Fonts' IP sharing.
- **ATTRIBUTION.md:** update it, and settle its open item on the Bodleian license (the 1.0 background).
- **Your decisions:**
  - the license for your own content and data (all rights reserved, or CC BY for the data)
  - confirm that the icons and logo are your own

## Milestone 8: Possible additions (C+M)

- **The Faith Received comparison:**
  - Pull its author index (1st–12th century), match it against Lifelines figures by name and dates, and rank the missing authors by prominence.
  - **Recommendation:** add only obvious, glaring gaps before launch. Every addition needs data entry, a date check and citations, so the rest is a post-launch list.
- Harp strings are covered in M3.

## Milestone 9: Go-live readiness (answers to item 8)

Gaps not on your list:

- **Share card.**
  - The page needs a meta description, Open Graph and Twitter tags, a canonical URL and a share image.
  - **This matters most for launch.** Substack and social links currently show no preview. **M:** custom domain? It also sets the canonical URL.
- **Supabase free plan:**
  - It has no backups. M5 adds a backup before any data edit.
  - The project pauses when idle. Real traffic prevents that, but quiet weeks can still trigger it.
  - **M decides:** move to Pro (about $25 a month, with daily backups) or accept the risk with a weekly backup.
- **Analytics:** add Cloudflare Web Analytics (cookieless, free) so launch traffic is visible. **M decides** whether to add it.
- **Feedback gate:** M adds a Cloudflare rate-limit rule on `/api/feedback`, a dashboard click I'll walk you through.
- **More testing rounds:**
  - **Real-device pass (M, 20 minutes, with a script I write):** iPhone Safari, Android Chrome, desktop Safari and Firefox. CI only tests Chromium, and Safari handles BC dates and canvas differently.
  - **Screen-reader smoke test (M or a friend):** VoiceOver on a Mac or iPhone, following the walkthrough in the ux-review skill.
  - **Beta round:** 3–5 real readers from your audience, given a short task script ("find Augustine; who was alive when he was born?"). They use the feedback button, and I triage the results. It finds problems no review does.
  - **Performance:** a Lighthouse run. MapLibre and the 1,700-line `works.js` load up front, so lazy-load them if the score warrants it.
- **Launch checklist:**
  - production env vars set and redeployed (Pages binds them at deploy time)
  - preview deploy reviewed
  - rollback = promote the previous Pages deployment

---

## Order and dependencies

```
M1 → M2 → M3 (review round) ─┐
           M4 (code) ─────────┼→ M9 checks → beta round → launch
M5 (data, needs network) → M6 (copy, after cull) → M7 (licensing) ─┘
M8 alongside M5
```

M1 and M2 come first because they change what every reviewer sees. M5 can start in parallel once the network is widened. Copy comes after the cull, so you don't edit tour text for figures you're about to remove.

## Verification (each milestone)

- `npm run test:unit`, `npm run build`, `npm run test:e2e`, and lint clean in the files touched.
- `npm run shots`. I read every affected PNG, including the dark ones, and run `ux-review` for reader-visible changes.
- DESIGN.md "Known violations" updated in the same commit.
- Site and redirect changes are checked on a Cloudflare **preview deploy**: I fetch it once the network is widened, or you check the URL.
- Data migrations: a dry run on a Supabase branch or in a transaction, then counts compared before and after with read-only queries. The snapshot is refreshed and re-shot to confirm the timeline still renders.
- Work lands as PRs on `claude/clever-curie-0627ec` (one per milestone), and CI runs on each.

## What M needs to do (in one place)

1. Widen Network access to Full: the environment menu in the title bar, then Edit.
2. Decide: custom domain; Supabase plan; analytics yes/no; license for your own content; confirm the icons and logo are yours.
3. The UI review round (M3), the cull checklist (M5), date disagreements (M5), and the copy edits (M6).
4. The Cloudflare rate-limit rule, the real-device and screen-reader passes, and recruiting 3–5 beta readers.
