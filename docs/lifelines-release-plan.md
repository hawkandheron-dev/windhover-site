# Lifelines release plan

> **Status:** M1 merged ([hawkandheron-dev/windhover-site#158](https://github.com/hawkandheron-dev/windhover-site/pull/158)). M2 is open as [hawkandheron-dev/windhover-site#159](https://github.com/hawkandheron-dev/windhover-site/pull/159), and Matthew's preview check passed 5/5. For step 2, `/?admin` showing a Sign In button while signed out is the intended result: `?admin` only reveals the button, and the admin tools appear after signing in. Still to confirm: plain `/` shows no Sign In button. M2 merged. **Now: M3**, detailed in the next section. Sync this file to `docs/lifelines-release-plan.md` on the next commit.

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
