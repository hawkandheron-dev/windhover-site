---
name: ux-review
description: Usability and accessibility review of rendered UI in this repo — Nielsen heuristics, WCAG 2.2 AA, keyboard, responsive, and states — grounded in screenshots and DESIGN.md. Use before calling any user-facing Lifelines change done, before a release, or when asked to review, audit or critique the UI.
---

# UX review

Evaluate what a reader actually sees, not what the code implies. Every finding
must point at evidence: a screenshot file, or a `file:line`. A finding without
evidence is an opinion; drop it or go and get the evidence.

## 1. Get the evidence

```bash
npm run build
CHROMIUM_PATH=/opt/pw-browsers/chromium npm run shots   # omit CHROMIUM_PATH outside the cloud sandbox
```

Read **every** PNG in `.shots/lifelines/` with the Read tool, and
`report.md` for console errors. If the change adds a state the script doesn't
capture (a new dialog, an error path), add it to `STATES` in
`scripts/lifelines-shots.mjs` first. A state you can't see can't be reviewed.

Remember what the sandbox can't show: Wikipedia text, images and map tiles are
blocked, so those areas show their fallback state. Review the fallback as a
fallback, and list what still needs checking on a real deploy.

Read `DESIGN.md` before judging. A rule there outranks a general heuristic
here. When the two disagree, report it as a question.

## 2. Walk it as the readers in DESIGN.md §1

For each reader, narrate the path in a few lines, noting where they would
hesitate, misread or get stuck:

1. **Newsletter subscriber on a phone, first visit.** Lands from Substack. Do
   they understand what this is within five seconds? Can they find one person
   they've heard of? Can they leave feedback?
2. **Student on a laptop looking up one figure.** Search → panel → follow a
   connection → get back. Is the figure's context (who else was alive) visible
   while the panel is open?
3. **Keyboard / screen-reader user.** Tab from the top. Is every control
   reached, in order, with a visible ring? Do the checkboxes, icon buttons and
   canvas items have names? Can the panel and dialogs be closed with Esc, and
   does focus return somewhere sensible?

## 3. Check against the list

Go through each one. Say "n/a" rather than skipping silently.

- **Nielsen's 10**: visibility of system status · match with the real world
  (historians' vocabulary, not ours) · user control and freedom (undo, back,
  Esc) · consistency and standards · error prevention · recognition rather than
  recall · flexibility and efficiency · aesthetic and minimalist design · help
  users recover from errors · help and documentation (the tour).
- **WCAG 2.2 AA**: contrast (compute it, don't eyeball it: 4.5:1 text, 3:1 large
  text and UI edges) · colour never the only signal · focus visible and not
  obscured (2.4.11, which sticky headers and floating legends commonly break) ·
  target size ≥24px minimum, 44px our phone rule · reflow at 320px width · names,
  roles and states on controls.
- **Responsive**: all four shot viewports look designed, not merely surviving.
  Nothing clipped, overlapping or unreachable. The 820px tablet is the usual
  casualty.
- **States**: loading, empty, error and partial data for every data-dependent
  area. Long names, missing dates, a figure with no connections.
- **Information hierarchy**: what's the first thing the eye lands on in each
  shot, and is that the most important thing?
- **Progressive disclosure**: is detail hidden until asked for, without hiding
  what most readers need?
- **Destructive or irreversible actions** (delete, submit, reset view):
  confirmed, or undoable.
- **Perceived performance**: is there a visible response within ~100ms of a
  click, and no layout shift as content arrives?
- **Consistency with primitives**: `.btn` variants, tokens, one breakpoint.
  Anything hand-rolled?
- **Removal**: what on screen could go without a reader missing it? Name it.

## 4. Report

Lead with a single sentence: is this ready, or what blocks it? Then a table,
most severe first:

| # | Sev | Where (element) | Problem | Evidence | Fix |
|---|---|---|---|---|---|

Severity (Nielsen): **4** blocks a task or excludes a group of readers, fix
before release · **3** major, fix soon · **2** minor · **1** cosmetic ·
**0** not a usability problem, but noted. A DESIGN.md violation is at least 2.

Then:
- **Removal candidates**: things to cut, each with its reasoning.
- **Not verifiable here**: what needs a real deploy (live data, images,
  Wikipedia, Clerk sign-in, Turnstile) or a real device (touch, screen reader).
- **DESIGN.md updates**: new known violations to append, or rules the review
  suggests changing. Propose these; don't edit rules without asking.

Keep fixes concrete: name the element and the change ("move the legend below
the header and collapse it to the ramp strip under 1100px"), not "consider
improving the legend".
