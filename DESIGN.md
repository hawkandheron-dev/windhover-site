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
  lifespans**. Publisher mark: **Windhover**.
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
| **Century ramp** (`CENTURY_COLORS`, `data/churchHistory2Centuries.js`) | *When* a figure lived | Only on figure bars and the legend's ramp strip. Always derived from dates by `colorForLifespan`, never picked per figure. A life spanning centuries is a gradient. Nothing filters by century. Never reuse ramp hues for UI chrome. |
| **Councils** `#3f7d46` + cross shape | A council | Colour is always paired with its shape — never colour alone. |
| **Texts & creeds** `#9a7b1f` + book shape | A text | Same: always with the shape. |
| **Reigns** `#6d4c41` (`BACK_STYLES.emperors`) | An emperor or monarch, background layer | The background layer holds reigns and nothing else. Adding anything to it is a design decision, recorded here first. |
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
| Header | Top, 56px (`--ch2-header-height`), above everything; on phones its own row | Search, Tour, Feedback. No site navigation and no sign-in for readers (the owner adds `?admin` to a clean URL). Its controls stay reachable at all times, including while the panel is open. On phones it must not cover the timeline's toolbar. |
| Timeline | Fills the rest | Figures and councils above the axis; texts and reigns below. The back layer shares the foreground's horizontal pan exactly; it must stay time-true. |
| Detail panel | Docked right on desktop; a modal below 768px | On desktop it **narrows** the timeline and never covers it. Nothing floats over it. |
| Opening view | 1–500 AD, centred, framed on the measured width | The welcome dialog offers the tour on a first visit (remembered under its own key). |
| Address | Lifelines is the site's front page, `/` | It is the only indexed page. The owner's admin entry is `/?admin`. Lifelines has no link to any other part of the site. |
| Legend | Floating, top right | Must not hide figures a reader is trying to read; it should collapse or move out of the way when space is tight. |
| Controls | Bottom left | Zoom, pan, depth (Off / Soft / Front). |

- **One breakpoint for mobile: 768px** (`useMobileDetect`). Lifelines CSS that
  switches layout for small screens uses `max-width: 768px`, not 600/640/900,
  so the CSS and the JS never disagree about which layout is live.
- Viewports that must look intentional: 390×844 (phone), 820×1180 (tablet
  portrait — gets the desktop canvas at its narrowest), 1280×720 (small
  laptop), 1440×900. These are the `npm run shots` viewports.

## 7. Density and labels

- Past `pointLabelMaxYearsPerPixel` (1.0 year/px), landmarks drop their flags
  and show only pins. The same applies to monarch labels.
- A label that doesn't fit should end with an ellipsis or show the name
  without dates. It should never be cut off mid-word by a neighbouring bar.
- Cards and labels must not overlap one another. Stacking is the layout's job
  (`utils/stacking`), not z-index.

## 8. Interaction and access

- Everything clickable is reachable by keyboard, in a sensible order, with a
  visible focus ring (`:focus-visible`).
- Touch targets are at least 44×44px on phone layouts.
- Motion respects `prefers-reduced-motion: reduce`: the depth blur transition,
  panel slide and viewport animations become instant.
- Text meets WCAG 2.2 AA contrast (4.5:1 body, 3:1 large text and UI
  boundaries) against white. `--color-ink-faded` on white is the floor.
- Filter checkboxes and icon-only buttons have accessible names.
- Every data-dependent area has a loading, empty and error state, including
  when Wikipedia or the map tiles fail. That is what the offline screenshots
  show, so they double as a test of those states.

## 9. Deliberately removed — don't bring back without asking

Manuscript background · parallax grey rules · era brackets and era colours ·
heresiarchs on the timeline · gold "defender" rings · the wavy connection
chain · movements · plain (non-council, non-text) events · filtering by
century. Most survive in data behind an `active` flag or in dormant files
(`churchHistory2Eras.js`), so restoring one is cheap. That is why it needs a
decision rather than a commit.

---

## Known violations

Fix them, or move them to a rule above as accepted exceptions. Delete each line
when it's fixed. First found 2026-10-03 by rendering the real dataset
(`npm run shots`); dark mode, the welcome copy, stray colours, button
contrast, reduced motion, legend checkbox names, the opening view, the zoom
readout and the phone header covering the toolbar were fixed in milestone 1.

- **§6 Legend:** covers figures at the right edge of every desktop view, and
  floats over the middle of the canvas while the panel is open
  (`panel--desktop.png`).
- **§7 Labels:** cut mid-word by neighbouring bars ("Thomas Bradwar",
  "Sylvester II / Gerbert of A"); landmark cards overlap on phone
  (`default--phone.png`).
- **§6 Hover card:** a landmark's hover card is left behind in the top-left
  corner when the pointer leaves the canvas upward into the header ("Rome",
  `panel--desktop.png`, `default-dark--desktop.png`).
- **§4 Phone toolbar:** the mobile timeline's toolbar is still parchment
  (beige ground, brown rules), not white (`default--phone.png`).
