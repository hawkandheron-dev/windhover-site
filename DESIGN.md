# DESIGN.md — Lifelines

The product rules for **Lifelines** (`timeline-scratch/src/ChurchHistory2App.*`,
served at `/apps/church-history-2.html`). These are invariants, not taste: each
one should be checkable against a screenshot or a diff. Method — how to build
and how to review — lives in `.claude/skills/`; this file says what is true of
*this* product.

If a change needs to break a rule, ask first. If the answer is yes, change the
rule here in the same commit, so the file never describes a product that no
longer exists.

The other apps in `timeline-scratch/` (1.0 Church History, Heresies, Bible
Atlas, …) use the parchment "Mews" tokens in `src/index.css` and are not
governed by this file, except where a rule below says shared code must leave
them unchanged.

---

## 1. What Lifelines is for

A reader should be able to see **who was alive at the same time as whom** in
church history, and follow one life into its connections. Everything on screen
serves that. The 2.0 rework was a cull: fewer things on screen, the remaining
ones more legible. A change that adds visual elements should say what it
replaces or why the reader needs it.

**Primary readers**, in priority order (the ux-review skill walks these):

1. A newsletter subscriber arriving from a Substack link, often on a phone,
   with no idea how the timeline works.
2. A student or church member on a laptop, looking up one figure.
3. Someone using a keyboard or screen reader.

## 2. Naming and copy

- The product is **Lifelines**. Strapline: **A church history timeline by
  lifespans** (upright, not italic). Publisher mark: **Windhover**, with its strapline **Get a
  bird's eye view**. Lifelines leads (top of the legend); Windhover signs off
  (foot of the legend).
- Never show "CH Timeline", "CH Timeline 2.0", "Church History Timeline" or
  "church-history-2" to a reader. Code identifiers and the route keep the old
  names on purpose — renaming the URL needs redirects and is its own decision.
- Years are stored historically (−63 is 63 BC). Every year shown to a reader
  goes through `formatYear` / `formatYearSpan` in
  `components/Timeline/utils/dateUtils.js`. Never hand-format one in a
  component: five inline copies once disagreed, and gave Augustus a birth in
  65 BC.
- The zoom readout names the years in view ("300–700 AD"), never a ratio.
- Write plainly and briefly. Sentence case for buttons and headings. No
  exclamation marks, no "Oops".

## 3. Colour — what each colour is allowed to mean

Colour on the canvas is data, so its meanings are fixed:

| Colour | Means | Rules |
|---|---|---|
| **Century ramp** (`CENTURY_COLORS`, `data/churchHistory2Centuries.js`) | *When* a figure lived, or *when* a year falls | On figure bars, and on the two things that stand for a year: the line under the pointer (3px, `config.cursorLine`) and the band of the Year dialog it opens (owner, 2026-10-08). There is no colour key; the legend does not explain it (owner's decision, M3). Always derived from dates by `colorForLifespan`, never picked per figure. A life spanning centuries is a gradient. Nothing filters by century. Never reuse ramp hues for UI chrome. |
| **Councils** `#3f7d46` + cross shape | A council | Colour is always paired with its shape — never colour alone. |
| **Texts & creeds** `#9a7b1f` + book shape | A text | Same: always with the shape. |
| **Reigns, by realm** (`REALM_STYLES`): Roman Empire maroon `#7a1f2b`, Eastern Roman purple `#5b3a86`, Western Roman rust `#9a4a1e`, later kingdoms slate `#4a5a6a` | An emperor or monarch, and which realm | Reigns and nothing else (owner, 2026-10-08; `rulerColorByRealm`). Each reign bar and crown takes its realm's colour; the detail band names the realm, which is where the colour is explained. They live in a **strip pinned to the foot of the timeline** (`rulerStyle: 'strip'`, owner's pick, round 6): a reign bar and a name each (22px rows, 13px names: big enough to notice Augustus when the tour first shows him; owner, 2026-10-08), at most five rows, panning sideways with the timeline. An "Emperors" tab on its top edge, at the right, folds it to one line of reign bars and back, remembered on the device (`rulerFoldKey`); the Key's switch still hides it outright. The controls sit above it and its tab. It slides up from the foot of the screen when it appears (the phone's column slides in from the right), and a ruler the tour brings in grows its reign bar and its name glows in arrival gold for about two seconds, so a reader sees it arrive (owner, 2026-10-08). Reduced motion keeps only the glow. A figure in focus marks their rulers there. On the vertical layout the same strip turns on its side: a **column pinned to the right edge**, up to four sub-columns of a thin reign bar with the name running down beside it, cut with "…" at the next reign (owner's pick, 2026-10-05). (A blurred band, then a quiet band under the axis, were tried and retired.) |
| **Detail frame** (`detailTypeBand`) | "This is that entry" | A detail dialog, card or panel is framed (3px) in its entry's colour: the figure's century, the council's green, the text's gold, the event's orange, the realm's colour, the year's century. The top edge is a band naming the kind of entry in white: Church figure, Council, Text, Event, Emperors & monarchs (with the realm), Year. Where white text would fall under 4.5:1 the band uses the same hue darkened just enough (`readableOnWhite`), never a different colour. It replaces the "Era:" line (owner, 2026-10-08). |
| **String gold** `--color-string-hover` `#e3a92b` | "This landmark, under the pointer" | Only for a harp string being hovered: its line (3px, over everything), label and dot, and a ring round each linked figure. Never at rest, never for anything else. |
| **Arrival gold** `--color-arrival` `#e8b23a` | "This just arrived" | The house way to make a new element stand out for a moment (owner, 2026-10-08): it appears washed in arrival gold and fades to its resting colour over about 2.5 seconds. Used for the rulers' strip (and its tab, and the phone's column) when it first appears, and for a ruler's name when the tour brings them in. Never at rest. Kept apart from string gold, which means the pointer. Not motion, so reduced motion keeps it. |
| **Events** `#b2622c` + dot | A major event | The dot mark, as on its string. Minor events are hidden for now. |
| **Action blue** `--color-action` | "Do this" | The only colour for a filled primary button. At most **one** filled primary per region (a dialog, the panel, the header). Never decorative, never a background wash. No other blues in UI chrome. |
| **Error** `--color-error` | Something failed | The only red for error text and states. |

Hex literals in component CSS are a defect. Use a token from `index.css` (as
overridden on `.ch2-app` in `ChurchHistory2App.css`); if no token fits, add one
there and to this table.

## 4. Ground, type, surfaces

- **White ground.** No parchment, manuscript photograph, texture, or parallax
  rules. All three have been tried and removed.
- **Ink** is `--color-ink`, `--color-ink-light`, `--color-ink-faded`. No other
  text greys.
- **Two typefaces**: Cormorant (display) and Alegreya Sans (body and UI),
  inherited from `index.css`. No third family, no monospace for UI labels.
  "Lifelines" in the Key is set in Alegreya Sans, not Cormorant: in the
  display face it read like a genealogy site (owner's call, 2026-10-05).
- **Buttons** use the `.btn` system in `index.css` (`.btn`, `.btn-icon`,
  `.btn-sm`, `.btn-action`, `.btn-rect`, `.btn-danger`). Don't style a button
  from scratch; add a variant there if one is genuinely missing.
- **Surfaces** that float over the canvas (legend, controls, search dropdown)
  are white with `--color-border-hover` and one shadow. No glass, no gradients.

## 5. Dark mode

Lifelines **holds its light palette** when the OS is in dark mode; it only
softens pure white to `#f7f7f5`. This is a decision, not an omission.

The mechanism: `church-history-2.html` sets `<html data-theme="light">`, and
`timeline-scratch/postcss-light-theme-optout.js` rewrites every shared dark
rule to skip a page that does. Write new dark rules for other apps normally;
they will not reach Lifelines. A dark-OS style Lifelines *does* want is
written against `:root[data-theme="light"]` (see `ChurchHistory2App.css`).
Every UI change is still checked in the `default-dark` screenshots.

## 6. Layout

| Region | Where | Rules |
|---|---|---|
| Header | Top, 56px (`--ch2-header-height`), above everything; on phones its own row | Search, Tour, Feedback, About. No site navigation and no sign-in for readers (the owner adds `?admin` to a clean URL). Its controls stay reachable at all times, including while the panel is open. On phones it must not cover the timeline's toolbar. |
| Timeline | Fills the rest | Figures and councils above the axis; texts and reigns below. The back layer shares the foreground's horizontal pan exactly; it must stay time-true. |
| Layout | Vertical (lives run down the page) or horizontal | Phones start **vertical**, wider screens **horizontal**; the reader switches with the Layout toggle and the choice is remembered on that device (`lifelines-layout`). Both are kept working. |
| Tour | Docked right on desktop; a bottom sheet on phones | On a phone the tour sheet is full width and at most 45% of the height, scrolling inside; the timeline keeps the top. The scene's picture is a 64px thumbnail beside the title, and each scene frames its figures in the vertical timeline (`frameYears`). A figure a step opens shows as a short card across the top, above the sheet (at most 40% of the height, no backdrop): name, dates, place and description, with no map, pictures or works; "More about …" opens the full detail. Outside the tour a tapped figure opens the full detail. A figure's centred dialog or card **grows out of their bar**: a block in the bar's colour opens from the bar to the dialog's place, then fades as the dialog fades in, and the dialog keeps its frame in that colour (§3 Detail frame); the page behind stays clear while it grows and darkens slowly once the dialog is open (owner: dimming at the same moment read as a strobe) (`detailGrowFromBar`; owner, 2026-10-08, after Irenaeus's dialog appeared from nowhere). With reduced motion it just appears. While the tour panel is docked, the dialog centres in the room left of it, above the controls. The scene's picture is credited in a small line under the text ("Picture: … · Source", linked to its Commons file page), never as an overlay on the picture, so it reads at every size. |
| Detail panel | Docked right in the horizontal layout on desktop; a modal on phones | On desktop it **narrows** the timeline and never covers it. Nothing floats over it. Wikipedia text carries a one-line CC BY-SA 4.0 note under it, and every map a plain "Map © OpenHistoricalMap contributors (ODbL)" line under it (`wikiLicenceNote`, `mapCreditLine`). |
| About | A dialog from the header's About button | What Lifelines is, its own licence (CC BY 4.0), credits for what it draws on, and a short privacy note. Closes with Esc or ×; focus returns to the button. Keep it current when a source, service or licence changes. |
| Opening view | 1–500 AD, centred, framed on the measured width (1–160 AD for the horizontal layout on a phone, `config.phone`); nothing before **100 BC** (`minYear`) | The welcome dialog offers the tour on a first visit (remembered under its own key). |
| Address | Lifelines is the site's front page, `/` | It is the only indexed page. The owner's admin entry is `/?admin`. Lifelines has no link to any other part of the site. Its share card (description, Open Graph image, canonical link) uses the site address set in `timeline-scratch/vite.config.js`; remake the image with `npm run shots -- --share` when the opening view changes. Clerk loads only for `?admin` or an already signed-in browser, never for readers. |
| Legend | Floating, top right, just below the header | Slim (`legendLayout: 'slim'`): Lifelines' name, the four show/hide switches (councils and texts with their shapes, reigns with the crown, figures with a neutral bar), Windhover at the foot. No colour key, no section headings. It folds to a "Key" button while the detail panel is open or the timeline is under 1100px wide; a reader's own open/close holds until that changes. At 1100px and wider it opens by default even though it covers a few top-right figures in the opening view (owner's decision, 2026-10-05). |
| Controls | Bottom left (horizontal); the toolbar (vertical) | Zoom, pan, the year readout and the Layout toggle (Vert / Horiz). No depth control: the rulers stay faint, and lift with a hovered or chosen figure, or while Alt is held. On a phone the arrows go (fingers pan) and the buttons are 44px. |

- The page is sized with `100dvh`, not `100vh`, so iOS Safari's address bar
  doesn't hide the bottom of the timeline.
- **One breakpoint for mobile: 768px** (`useMobileDetect`). Lifelines CSS that
  switches layout for small screens uses `max-width: 768px`, not 600/640/900,
  so the CSS and the JS never disagree about which layout is live.
- Viewports that must look intentional: 390×844 (phone), 820×1180 (tablet
  portrait — gets the desktop canvas at its narrowest), 1280×720 (small
  laptop), 1440×900. These are the `npm run shots` viewports.

## 7. Density and labels

- **Landmarks are harp strings** (`pointStyle: 'string'`, owner's pick, M3):
  a thin line through the whole timeline at the landmark's year, drawn
  **behind** every bar and name, with its title beside the axis: councils
  and events above, texts below. Titles stack into rows by their measured
  width (`pointLabelRows`: 3 above, 5 below; owner, 2026-10-08: "titles for
  all the events, and texts and councils too"). Each band keeps its height at
  every zoom, so figures never jump as rows fill. Only where every row is
  full is a title dropped; its line and mark stay, and hover names it.
- Each kind has one **mark**, the same size everywhere (dots, labels, Key,
  search): a **diamond** for a council, a **square** for a text, a **dot**
  for anything else (`StringMark.jsx`).
- Labels give the **full name** and never change under the pointer; hover
  only lifts the label and turns its string gold. (Short labels that grew on
  hover were tried in round 3 and withdrawn.)
- Every string has a **dot**, its handle (`utils/stringDots.js`). A landmark
  linked to figures alive that year (`CH_EventConnections`) puts a dot on
  **each** of their bars, on the lower edge, clear of the name. Anything else goes
  in open space, never on a bar, since a dot on a bar says "this person was
  involved". It takes the free spot nearest the axis, clear of bars, labels
  and other dots. A labelled landmark with no living linked figure needs no
  dot.
- Line, label and dot hover gold together, and each opens the landmark; the
  hovered string is redrawn **in front** of everything at three times its
  width, and every figure linked to it gets a gold ring. The line is a target
  only between bars: over a bar, the bar keeps the pointer.
- **On the vertical timeline** the strings run across, at the year, behind
  the bars. Labels sit in a column of their own between the year axis and
  the figures (right-aligned, at most three lines, the first level with the
  string), so they never sit on a bar; the column goes when no landmark is
  shown. A label that would run into the one above is dropped, and its mark
  stays on the string. Two marks in the same few pixels step sideways along
  it, so both can be tapped. Linked figures get a mark on their bar's edge
  (`utils/verticalStrings.js`).
- The vertical timeline is on white too: a white toolbar and a light year
  gutter with ink years. Zooming keeps the year in the middle (or between
  the fingers) where it was.
- Monarch labels drop past `pointLabelMaxYearsPerPixel` (1.0 year/px).
- A name label may run into empty space but never into the next bar of its
  row. If it doesn't fit, the dates go first, then the name ends in "…"; with
  under 28px of room there is no label, and hovering names the bar
  (`labelFit: 'fit'`, `utils/labelFit.js`). The same rule applies to the
  rulers' labels below the axis. A test checks this against the real data.
- Cards and labels must not overlap one another. Stacking is the layout's job
  (`utils/stacking`), not z-index.

## 8. Interaction and access

- Everything clickable is reachable by keyboard, in a sensible order, with a
  visible focus ring (`:focus-visible`).
- **Search is the keyboard and screen-reader route to the timeline** (owner's
  decision, M3). Figures and landmarks are drawn on a canvas and can't be
  tabbed through; search reaches every one of them. So the route has to
  work end to end:
  - a "Skip to search" link is the first stop;
  - the welcome dialog takes focus on its main button, and returns the
    keyboard to the top of the page when it closes;
  - choosing a result opens the panel with focus on its title (no focus ring:
    the title is not a control, and the ring read as a selection box);
  - Esc closes the panel and hands focus back to search.
  A test walks this route. Full arrow-key navigation of the canvas is out of
  scope for launch.
- Touch targets are at least 44×44px on phone layouts.
- Hover (cursor line, year chip, hover card) follows the pointer that
  actually moved: a mouse always gets it, a finger never does. It is not
  decided by the `(hover: none)` media query, which some desktops report with
  a mouse attached (M4).
- Without WebGL the maps can't draw; the panel and year summary still open,
  with "The map can't be shown in this browser." in the map's place (M4).
- Leaving the tour, the figures and landmarks it wasn't showing **sweep in**:
  bars grow from their birth years in a left-to-right wave (0.8s across the
  screen), names and strings fading in behind. Nothing else on the page moves.
- Motion respects `prefers-reduced-motion: reduce`: the depth blur transition,
  panel slide, viewport animations, bar growing and the tour-exit sweep
  become instant.
- Text meets WCAG 2.2 AA contrast (4.5:1 body, 3:1 large text and UI
  boundaries) against white. `--color-ink-faded` on white is the floor.
- Filter checkboxes and icon-only buttons have accessible names.
- Every data-dependent area has a loading, empty and error state, including
  when Wikipedia or the map tiles fail. That is what the offline screenshots
  show, so they double as a test of those states.
  The timeline's own load failing says, in plain words, "Lifelines couldn't
  load the timeline. Check your connection and try again." with a "Try again"
  button; the technical message goes to the console, never the page (M4).

## 9. Deliberately removed — don't bring back without asking

Manuscript background · parallax grey rules · era brackets and era colours ·
heresiarchs on the timeline · gold "defender" rings · the wavy connection
chain · movements · minor landmarks (non-ecumenical councils and minor
events, `significance = 'minor'`; major events returned in M3 round 5) · filtering by
century. Most survive in data behind an `active` flag or in dormant files
(`churchHistory2Eras.js`), so restoring one is cheap. That is why it needs a
decision rather than a commit.

---

## Known violations

Fix them, or move them to a rule above as accepted exceptions. Delete each line
when it's fixed. First found 2026-10-03 by rendering the real dataset
(`npm run shots`); dark mode, the welcome copy, stray colours, button
contrast, reduced motion, legend checkbox names, the opening view, the zoom
readout and the phone header covering the toolbar were fixed in milestone 1;
the stray hover card, the legend covering figures, the phone's overlapping
landmark cards and its parchment toolbar in milestone 3 (on screens under
1100px; see the first line below).

- **§6 Controls with the panel open:** the zoom, readout and layout controls
  float over figure bars at the bottom left (Clement of Rome and Polycarp in
  `panel--laptop.png`), and at 820px their labels wrap to two lines ("Zoom /
  in", "50–340 / AD" in `panel--tablet.png`). Found by the M3 ux-review The owner is
  researching a rework of the controls (navigation comparison doc,
  2026-10-05).

