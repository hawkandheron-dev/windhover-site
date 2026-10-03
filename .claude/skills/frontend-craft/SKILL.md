---
name: frontend-craft
description: How to build or change UI in this repo so it fits the existing product rather than reinventing it — DESIGN.md first, existing primitives, every state, restraint with decoration and motion, then render and look. Use whenever writing or changing JSX/CSS that a reader will see.
---

# Frontend craft

Lifelines has an established visual language, so the job is to execute within
it well, not to invent a new aesthetic. The general advice about bold,
distinctive design applies to new products. Here it would mean drift. When
this skill and `DESIGN.md` disagree, `DESIGN.md` wins.

## Before writing code

1. Read `DESIGN.md`, especially the colour table and "deliberately removed".
2. Read the component you're changing **and** whatever else renders it.
   Lifelines shares `Timeline`, `TimelineModal`, `TimelineLegend`, the Tour and
   more with five other apps.
3. Write down, briefly: what the reader needs, which existing primitives cover
   it, and which states it has (below). If you can't name the reader's need,
   stop and ask.

## Rules of execution

- **Reuse before you create.** `.btn` variants, tokens from `index.css` as
  overridden on `.ch2-app`, existing icons in `Icon.jsx`, existing formatters
  for dates. A new hex value, font size, radius or shadow needs a reason, and
  then a token and a line in DESIGN.md.
- **Shared code is opt-in.** Change shared components behind a prop or config
  key whose default is the old behaviour. The other pages should stay
  pixel-identical. Say in the commit which pages you checked.
- **Every state.** For anything data-dependent: loading, empty, error, partial
  (some fields missing), and extreme (the longest name in the data, a lifespan
  of 120 years, a figure with 30 connections). The snapshot in
  `tests/e2e/data/` has real extremes. Use them.
- **Structure is information.** Borders, dividers, headings, numbering and
  labels should each encode something true about the content. If one is there
  only to decorate, remove it.
- **Restraint with the AI-generated defaults.** Avoid: all-caps eyebrow labels
  above every heading; one word in a headline set in a different colour or
  italic; identical rounded cards with the same soft shadow for unrelated
  content; gradient washes; `→` appended to link text; middle-dot meta strings;
  monospace for small labels. Each is fine when it's a real choice. As a
  reflex, it reads as generated.
- **Motion answers the reader.** Use it to show what changed after an action
  (panel opens, layer comes into focus). Don't add entrance animations or hover
  flourishes everywhere. Every transition needs a `prefers-reduced-motion`
  fallback.
- **Copy is design.** Write the real words, short, in sentence case, in the
  reader's vocabulary (historians', not ours: "figure", "council", "reign", not
  "entity", "point", "back layer"). Read DESIGN.md §2 for naming.
- **Accessible by construction.** Use semantic elements (`button`, `label`,
  `dialog`), give icon-only controls names, use `:focus-visible` rings, and
  make targets ≥44px on phone. This costs almost nothing up front and a lot
  later.

## Render, look, iterate

You haven't finished when the code compiles. You've finished when the
screenshots look right.

```bash
npm run build && CHROMIUM_PATH=/opt/pw-browsers/chromium npm run shots
```

Read the affected PNGs (and the dark ones; see DESIGN.md §5). Compare them
with what you intended and with DESIGN.md. Fix, rebuild, look again. Expect
two or three rounds. Several past Lifelines bugs (cascading callouts,
unregistered axes, an empty tour) were only visible this way.

When it looks right, run the `ux-review` skill for any change a reader would
notice, then the tests (see CLAUDE.md).
