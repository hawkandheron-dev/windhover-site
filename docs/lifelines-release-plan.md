# Lifelines release plan

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
- On the preview deploy, confirm `/?admin` keeps its query through Pages' redirects (the local test server drops it from `.html?admin`, so admin links should use clean URLs).
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
3. **Harp strings (7A).** Prototype behind `config.pointStyle: 'string'`:
   - **What changes:** each landmark becomes a thin full-height line at its year, with a small label near the axis. The stacking rows go, which frees vertical space.
   - **How it's built:** it plugs into `TimelineOverlay.renderPointCallouts` (or `TimelineCanvas.renderPoints`) and the layout sizes. It reuses `yearToPixel` and the canvas hit map, with a narrow hit box so strings don't take hover from the bars they cross.
   - **Bonus:** the focus set can brighten a focused person's strings, which fixes the dead highlighting.
   - **Decision:** I'll show you side-by-side screenshots of flags and strings at three zoom levels, and you pick.
4. Fix what you mark, iterating on the screenshots. Fixes go through `frontend-craft`.

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
