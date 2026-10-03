# CH Timeline — Design Review

> **Historical.** This reviews the 1.0 parchment timeline and predates
> Lifelines (2.0). Some items were fixed, some were made moot by the 2.0
> rework. The current rules are in `/DESIGN.md`; the review method is the
> `ux-review` skill.

Comprehensive design review based on app and web design best practices.
Covers: main view, modals, search, filters, mobile, overlay, and cross-cutting concerns.

## Implemented Changes

The following changes have been implemented (see commit):

- **Delete person/point with confirmation** — "Delete person" / "Delete event" button at bottom
  of Person and Point detail modals, with "Are you sure?" confirmation dialog.
  (`TimelineModal.jsx`, `timelineItemService.js`)

- **Works displayed as comma-separated hyperlinks** — The Works/Texts section now renders as
  inline comma-separated links instead of a vertical `<ul>` list. Titles link to their text URL
  when available. (`TimelineModal.jsx`)

- **Edit mode for Works, Sources, and Connections** — Authenticated users see an "Edit" button
  next to Works, Sources, and Connections headings. Clicking it opens an inline edit form.
  Saving does NOT close the modal. (`TimelineModal.jsx`, `timelineItemService.js`)

- **PointConnections (event/text → person)** — Events and texts can now be related to People
  via a new `CH_EventConnections` table. The detail modal shows "Related People" for points
  and allows editing when authenticated. The adapter fetches and includes `connectedPeople`
  in point data. (`churchHistorySupabaseAdapter.js`, `TimelineModal.jsx`,
  `timelineItemService.js`)

- **Description shown for People** — The adapter now includes the `description` field for
  regular people (previously only emperors had it). The modal already handled rendering it.
  (`churchHistorySupabaseAdapter.js`)

- **Wikipedia/Britannica attribution moved to top** — The "From Wikipedia" / "From Britannica"
  label now appears above the description text (not as a "Read more" link at the bottom).
  Styled as an uppercase label linking to the source. (`TimelineModal.jsx`, `TimelineModal.css`)

- **Saving in edit mode keeps modal open** — `handleSaveEdit` exits edit mode on success but
  does not call `onClose()`. The modal stays open with the read-only view of the updated data.
  (`TimelineModal.jsx`)

---

## 1. Main Timeline View (Desktop)

### 1a. No onboarding or discoverability cues — HIGH
The timeline drops users into a pannable/zoomable canvas with zero guidance. There's no
indication that you can scroll-wheel to zoom, click-drag to pan, or click blank space for a
year summary. First-time users will likely miss most features.

**Recommendation:** Add a subtle first-visit tooltip or coach mark overlay (e.g., "Scroll to
zoom, drag to pan, click a year for details"). Can be a dismissible banner or a small `?` button
in the controls area that toggles hints. Store dismissal in `localStorage`.

### 1b. Cursor year tooltip clips at viewport edges
The cursor year display (`Timeline.jsx:591-611`) is positioned with a fixed `+12px`/`-10px`
offset from the mouse. At viewport edges this will clip off-screen since there's no boundary
clamping.

**Recommendation:** Clamp the tooltip position so it stays within the container bounds, similar
to how the hover preview does (`Math.min(mouseX + 15, width - 250)` in
`TimelineOverlay.jsx:358`).

### 1c. Zoom level indicator is not user-friendly — MEDIUM
The zoom info shows `{(1/yearsPerPixel).toFixed(2)}x`. This internal ratio is meaningless to
users — "0.37x" communicates nothing about scale.

**Recommendation:** Replace with a human-readable indicator like "~50 years visible" or
"Viewing 30 AD – 250 AD". This gives spatial context instead of an abstract multiplier.

### 1d. Controls lack grouping/hierarchy
Zoom in, zoom out, reset, and the zoom indicator are laid out as a flat row of equal-weight
buttons. The reset action is destructive (loses current viewport) but is styled identically to
zoom in/out.

**Recommendation:** Visually separate reset from zoom buttons (add a divider or different
styling). Consider making reset a text-only or outlined button to reduce its visual prominence
relative to zoom.

### 1e. Inline styles on cursor line and year display
The cursor year line and display use 15+ lines of inline styles each. This makes them harder to
maintain and prevents dark mode support via CSS media queries.

**Recommendation:** Move these to CSS classes in `Timeline.css`. The cursor year display
currently uses hardcoded `rgba(0,0,0,0.8)` background that won't adapt to dark mode.

### 1f. Blank-click year summary is too easily triggered — MEDIUM
Clicking anywhere on the blank canvas opens a year summary modal. The 5px/300ms threshold is
low — users attempting to click on a small item and missing will accidentally trigger the modal.

**Recommendation:** Increase the movement threshold or require a double-click for the year
summary. Alternatively, add a brief visual confirmation before committing to the modal.

---

## 2. TimelineModal (Item Detail)

### 2a. Modal lacks structured visual hierarchy — MEDIUM
The modal content is a flat vertical flow: image, title, date, location, map, era, description,
wiki, works, connections, related points, related periods, links, sources, notes. With all
sections visible, this becomes a wall of content with no visual grouping.

**Recommendation:** Group related content into collapsible sections or tabbed panels. At minimum,
add section headers with consistent styling for "Overview" (dates/location/era), "Description"
(own + wiki), "Relationships" (connections/related), and "References" (works/links/sources).

### 2b. No loading skeleton for Wikipedia content
When the wiki description loads, users see "Loading description..." in italic text. The layout
shifts when content arrives.

**Recommendation:** Use a skeleton placeholder (animated gray bars) instead of text to prevent
layout shift.

### 2c. dangerouslySetInnerHTML without sanitization
Both `descriptionHtml` and `wikiDesc.text` are rendered via `dangerouslySetInnerHTML`. The
`linkifyDescription` function uses `DOMParser` which provides some sanitization, but the
Wikipedia content is injected directly.

**Recommendation:** Run Wikipedia HTML through a sanitizer (like DOMPurify) before rendering.

### 2d. Google search link uses emoji
The search link in the title uses a raw emoji which renders inconsistently across platforms and
looks out of place in the parchment design.

**Recommendation:** Replace with an SVG icon from the existing `Icon.jsx` system.

### 2e. Modal max-height is fixed at 80vh
On shorter viewports (laptops), 80vh still leaves significant dead space.

**Recommendation:** Consider `85vh` for laptop-class viewports via media query.

### 2f. Close button overlaps with image
When an item has an image, the close button sits directly on top of the image with no background
contrast guarantee.

**Recommendation:** Give the close button a default semi-transparent background, or position it
outside the image area.

### 2g. No back/forward navigation between items — HIGH
When a user clicks a connection in a modal to view another person, there's no way to go "back"
to the previous item. The mental model is broken — users expect browser-like navigation when
following links.

**Recommendation:** Maintain a modal history stack. Add a back arrow button when the user has
navigated from one item to another within the modal.

---

## 3. YearSummaryModal

### 3a. Active Periods and Events are not clickable (inconsistently)
`activePeriods` and `yearPoints` render as plain text with color dots, but `otherPeople` and
`nearbyPoints` are clickable buttons. This inconsistency breaks the interaction model.

**Recommendation:** Make all items clickable — periods and year events should open their
respective detail modals.

### 3b. Section title "Notable events and texts around [year]" is verbose
Wraps awkwardly on narrow viewports.

**Recommendation:** Shorten to "Nearby Events (±25 years)" or similar.

### 3c. Sparse modal when most sections are empty
When only nearby points exist, the modal feels empty with no context.

**Recommendation:** Add a brief contextual message when most sections are empty.

---

## 4. TimelineSearch

### 4a. Search icon doesn't communicate "search" — HIGH
The search input uses `<Icon name="diamond" />`, a decorative diamond shape — not a search
metaphor. Users expect a magnifying glass.

**Recommendation:** Replace with a standard search/magnifying glass icon.

### 4b. Find mode is undiscoverable — MEDIUM
The transition from autocomplete to find mode (press Enter without selecting) is not communicated
anywhere.

**Recommendation:** Add a hint in the dropdown footer: "Press Enter to find all matches on
timeline".

### 4c. Autocomplete caps at 12 results with no indication of more
If a query matches 50 items, users see 12 with no indication that more exist.

**Recommendation:** Show a "12 of 50 matches — press Enter to find all" footer in the dropdown.

### 4d. Search dropdown may overflow on mobile
The dropdown uses absolute positioning that may overflow off-screen on mobile.

**Recommendation:** On mobile, consider rendering as a full-width bottom sheet or ensure
viewport boundary checking.

### 4e. 180ms blur timeout is fragile
`handleBlur` uses `setTimeout(() => setIsOpen(false), 180)`, a known anti-pattern that can race
with click events on slow devices.

**Recommendation:** Use `relatedTarget` checking in the blur handler instead of a timeout.

---

## 5. TimelineLegend (Filters)

### 5a. Legend panel obscures timeline content — MEDIUM
Fixed at `top: 20px; right: 20px` with no way to collapse or hide it.

**Recommendation:** Make the legend collapsible with a toggle button (like mobile's filter
drawer). Show a compact icon-only row when collapsed.

### 5b. Checkbox + click-anywhere creates duplicate event handling
Both the checkbox `onChange` and the parent `div.onClick` handle the toggle, relying on
`stopPropagation` to prevent double-firing.

**Recommendation:** Use a `<label>` wrapping the entire row (like mobile does), which natively
handles click delegation to the checkbox.

### 5c. "Legend" title doesn't communicate interactivity
The title "Legend" suggests a passive key, not active filters.

**Recommendation:** Change the title to "Filters" or "Show/Hide".

---

## 6. MobileTimeline

### 6a. Touch targets are too small — HIGH
Person lanes can be as narrow as 28px tall. Minimum recommended: 44px (Apple HIG) or 48dp
(Material).

**Recommendation:** Change `Math.max(height, 28)` to at least `Math.max(height, 44)`.

### 6b. Pinch-to-zoom has no visual feedback
Content just snaps to the new scale with no animation or indicator.

**Recommendation:** Add a brief scale transition or a zoom level indicator during pinch gestures.

### 6c. Zoom label "8.0px/yr" is developer-facing — MEDIUM
Meaningless to users.

**Recommendation:** Show the visible year range or a qualitative scale.

### 6d. No scroll-to-top/navigation shortcut
The mobile timeline can be extremely tall with no way to jump to a specific era.

**Recommendation:** Add a floating "jump to era" quick-nav or a minimap indicator.

### 6e. Period banners at z-index 14 can block touches
When multiple periods overlap, their labels can stack and block access to underlying person
lanes.

**Recommendation:** Limit period label height or make them semi-transparent to prevent blocking.

---

## 7. TimelineOverlay

### 7a. Hover preview renders with empty content — MEDIUM
`renderHoverPreview()` shows just the name for most items, duplicating the label already on the
timeline.

**Recommendation:** Only show the hover preview when there's meaningful additional content.

### 7b. All overlay styles are inline
Every label and callout uses extensive inline styles (15-25 properties each). Prevents dark mode
support and increases maintenance burden.

**Recommendation:** Extract shared styles into CSS classes in `TimelineOverlay.css`.

### 7c. Point callouts can overlap
Multiple points at similar years will have overlapping callout cards.

**Recommendation:** Apply stacking/collision avoidance to point callouts.

---

## 8. Cross-Cutting Concerns

### 8a. Inconsistent dark mode implementation — HIGH
Some components use CSS media queries for dark mode, but the TimelineOverlay and cursor year
display use hardcoded light-mode colors in inline styles. Canvas rendering also uses hardcoded
colors.

**Recommendation:** Centralize the color palette into CSS custom properties and apply them
consistently. The canvas will need to read computed styles or accept a theme prop.

### 8b. No loading state for main timeline
Plain "Loading data from Supabase..." text with no skeleton or spinner.

**Recommendation:** Add a proper loading skeleton or centered spinner in the parchment design
language.

### 8c. Error state is minimal
Just `Error: {error}` in red text with no recovery action.

**Recommendation:** Add a retry button and more descriptive messaging.

### 8d. Duplicated code between AuthenticatedApp and UnauthenticatedApp
These two components share ~90% identical markup.

**Recommendation:** Extract the shared layout into a single component and conditionally render
the auth section.

### 8e. No URL state / deep linking — MEDIUM
Current viewport and selected item are purely in React state. Refreshing loses position; sharing
a link to a specific person or year is impossible.

**Recommendation:** Sync viewport and selected item to URL search params (e.g.,
`?year=325&zoom=0.5&item=nicaea`).

### 8f. Performance — canvas redraws on every hover
`TimelineCanvas` re-renders on every `hoveredItem` change, meaning every mouse movement over an
item triggers a full canvas repaint.

**Recommendation:** Separate the hover highlight into a second canvas or CSS overlay so the main
canvas doesn't need to redraw on mouse movement.

---

## Priority Summary

| Priority | Issue | Impact |
|----------|-------|--------|
| **High** | No onboarding/discoverability (1a) | Users miss core features |
| **High** | Modal navigation history (2g) | Broken mental model |
| **High** | Search icon not a magnifying glass (4a) | Confusing affordance |
| **High** | Mobile touch targets too small (6a) | Usability failure |
| **High** | Inconsistent dark mode (8a) | Broken dark mode experience |
| **Medium** | Zoom indicator not user-friendly (1c, 6c) | Confusing information |
| **Medium** | Year summary too easily triggered (1f) | Accidental modal opens |
| **Medium** | Modal content hierarchy (2a) | Content readability |
| **Medium** | Legend not collapsible (5a) | Viewport space waste |
| **Medium** | No URL state (8e) | Can't share/bookmark positions |
| **Medium** | Hover preview empty content (7a) | Visual clutter |
| **Medium** | Find mode undiscoverable (4b) | Feature discovery |
| **Low** | Inline styles in overlay (7b) | Maintenance burden |
| **Low** | Duplicated app components (8d) | Code maintenance |
| **Low** | Loading/error states (8b, 8c) | Polish |
| **Low** | Point callout overlap (7c) | Edge case visual issue |

---

## 9. Contribution Flows: Architecture Review

The app currently has **two parallel contribution paths** with different UX models, data
structures, and admin surfaces. This section reviews both flows and proposes a consolidation
strategy.

### 9a. Issue Creator Flow (simpler, cross-app)

**Files:**
- `IssueCreatorButton.jsx` / `IssueCreatorModal.jsx` — UI
- `issueService.js` — Supabase client calls
- `App_Issues` table — storage (migration: `20260222110000_app_issues.sql`)

**UX:** Title + free-text description + issue type pill selector (General / Data Correction /
Feature Request / Bug). Page context (app, URL, current view) is auto-captured as JSON. Available
to both contributors and admins. Cross-app via `app_id` column ('ch-timeline', 'bible-atlas').

**Admin side:** Resolve/close. No structured review or apply step.

**Strengths:**
- Low friction — contributors describe issues in their own words
- Works across all apps with no entity-specific knowledge
- Auto-captured context gives admins enough info to investigate

**Weaknesses:**
- No structured data output — admin must manually interpret and apply corrections
- No diff view or approval-applies-changes workflow
- No screenshot support yet (placeholder exists)

### 9b. Data Suggestion Flow (complex, CH-only)

**Files:**
- `SuggestNewModal.jsx` — entity type picker → `EditEntityForm.jsx`
- `EditEntityForm.jsx` — structured form (8–16 fields per entity type)
- `suggestionService.js` — Supabase client calls
- `AdminSuggestionsPage.jsx` / `AdminSuggestionsPage.css` — admin review with diff table
- `CH_Suggestions` table — storage (migration: `20260208180000_contributor_suggestions.sql`)

**UX:** Pick entity type (Person/Event/Era) → fill out every structured field (name, dates,
location, role_type, era_id, monarch fields, reference_url, description, notes). Two modes:
suggest new entity, or edit existing. Contributors must know the exact data format.

**Admin side:** Diff table showing current vs. suggested values. Approve auto-applies changes
to the real CH_People/CH_Events/CH_Eras tables. Reject with optional notes.

**Strengths:**
- Structured data goes directly into Supabase — approval is one click
- Diff view gives admins clear change visibility
- Covers both new entries and edits to existing records

**Weaknesses:**
- **Very high friction** — contributors must fill 8–16 fields, know date formats, understand
  entity types, know what era_id values exist, etc.
- CH-only — no equivalent exists for Bible Atlas (BP_Places, BP_People, etc.)
- The form is essentially an admin data-entry tool exposed to contributors
- For "I think Athanasius's death date is wrong" — the contributor must load the full form,
  find the right field, and change it, rather than just saying so

### 9c. Consolidation Strategy — HIGH

**Goal:** Merge both flows into a single, low-friction contribution path that produces
structured data.

**Proposed approach: Unstructured text + LLM parsing**

1. **Single contributor modal** — replaces both `IssueCreatorModal` and `SuggestNewModal`.
   Contributors write free-text descriptions ("I'd like to add Irenaeus of Lyon, he was a
   bishop who lived ~130–202 AD" or "The Council of Chalcedon date should be 451, not 450").

2. **LLM parsing step** — a Supabase Edge Function receives the free-text submission and
   calls a public LLM API (e.g., Claude or OpenAI) with the database schema as context.
   The LLM returns structured JSON matching the target table schema (CH_People, CH_Events,
   BP_Places, etc.), along with a confidence score and any ambiguities it identified.

3. **Admin review with AI-structured data** — the admin sees the original free text alongside
   the LLM-parsed structured fields in the existing diff table format. The admin can edit
   any field before approving. This preserves the approve-applies-changes workflow.

4. **Unified table** — a single `App_Contributions` table (or renamed `App_Issues` with
   additional columns) stores both simple feedback and data contributions. Columns:
   - `app_id` — which app
   - `contribution_type` — 'feedback' | 'data_suggestion' | 'correction'
   - `raw_text` — the contributor's free-text input
   - `parsed_data` — JSONB, LLM-structured output (null for plain feedback)
   - `target_table` — e.g. 'CH_People', 'BP_Places' (null for feedback)
   - `target_entity_id` — for corrections to existing records
   - `status`, `submitted_by`, `reviewed_by`, etc.

**Architecture for the Edge Function:**

```
Contributor writes free text
        │
        ▼
┌─────────────────────┐
│  Supabase Edge Fn   │  ← receives { raw_text, app_id, context }
│  (Deno + LLM API)   │  ← calls Claude/OpenAI with schema + text
│                     │  ← returns { parsed_data, target_table, confidence }
└─────────────────────┘
        │
        ▼
App_Contributions row created with raw_text + parsed_data
        │
        ▼
Admin reviews: sees raw text + structured fields side by side
Admin can edit fields → Approve applies to real table
```

**Benefits:**
- Contributor friction drops from ~16 fields to a single text box
- Works for all apps (CH Timeline, Bible Atlas) without app-specific forms
- Admin still gets structured data and the approve-applies workflow
- The LLM handles date parsing, entity type detection, field mapping
- Easy to extend to new data types without building new forms

**Migration path:**
1. Keep the existing issue flow working as-is during development
2. Build the Edge Function + new modal in parallel
3. Once the LLM flow is validated, deprecate both old flows
4. The `EditEntityForm` remains useful for admin direct editing (non-contributor path)

---

## 10. Button & Visual Consistency Audit

### 10a. Multiple competing button systems — HIGH

The codebase has **five independent button styling systems** that use different padding, radius,
font-size, and color approaches:

| System | Padding | Radius | Font | Used In |
|--------|---------|--------|------|---------|
| `.btn` (design system) | 6px 14px | 999px (pill) | 13px/600 | Header, filters |
| `.issue-btn-*` | 8px 16–20px | 8px | 13px/600 | Issue modal |
| `.edit-form-btn` | 6px 18px | 999px | 13px/500 | Edit form |
| `.note-btn` | 8px 18px | 8px | 14px/600 | Notes modals |
| `.suggestion-btn` | 7px 20px | 999px | 13px/600 | Suggestions page |

**Recommendation (implemented in this pass):** Consolidate all buttons onto the `.btn` base
class system in `index.css`. Add `.btn-rect` for modal contexts (rounded-rect instead of pill),
`.btn-accent` for the brown primary action, `.btn-danger` for destructive actions, and
`.btn-success` for approval actions.

### 10b. `.btn-issue-report` uses `!important` overrides

`IssueCreatorModal.css:268-272` overrides the base `.btn` with `!important` to shrink the
header "Submit Feedback" button to `4px 10px` / `12px` font — making it noticeably smaller than
adjacent header buttons.

**Recommendation:** Remove the `!important` overrides. The button should use the standard `.btn`
sizing to match its neighbors.

### 10c. Hardcoded colors instead of CSS custom properties

Most component CSS files use hardcoded hex values (`#2c2418`, `#faf6eb`, `#7a6f5f`, `#8b7355`)
instead of the CSS custom properties defined in `index.css` (e.g., `var(--color-ink)`,
`var(--color-parchment-light)`, `var(--color-ink-faded)`, `var(--color-accent)`). This makes
theme changes require touching every file.

**Recommendation:** Migrate component CSS to use the existing custom properties where exact
matches exist. For colors that don't have a token yet, add new tokens to the design system.

### 10d. Issue type pills use unique border-radius

`.issue-type-pill` uses `border-radius: 16px` — neither the pill (999px) nor the rounded-rect
(8px) from the design system. These are toggle pills similar to filter buttons elsewhere.

**Recommendation:** Use `var(--radius-pill)` for consistency with filter-style toggles.
