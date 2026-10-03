# CLAUDE.md

How to work in this repository. For what's in it, read `README.md` and
`docs/REPO_MAP.md`. For how Lifelines must look and behave, read `DESIGN.md`.

## Current priority

Releasing **Lifelines**, the church history timeline (code:
`timeline-scratch/src/ChurchHistory2App.jsx`, data:
`src/data/churchHistory2*.js`, route: `/apps/church-history-2.html`). Prefer
work that moves it toward release, and flag anything that would delay it.

## Rules

1. **UI changes start from `DESIGN.md`.** If a change would break one of its
   rules, ask before doing it. If the rule changes, update DESIGN.md in the
   same commit.
2. **Shared code is opt-in.** Lifelines shares the Timeline renderer, modal,
   legend, tour and services with five other apps. Put new behaviour behind a
   prop or config key that defaults to the old behaviour, so the other pages
   stay identical.
3. **Look at it before calling it done.** For any change a reader can see:
   build, run `npm run shots`, read the screenshots, iterate. Then run the
   `ux-review` skill. Reasoning from JSX/CSS alone has repeatedly missed
   real bugs here.
4. **Don't rename the route** or the `ChurchHistory2*` / `ch2-` identifiers.
   The reader-facing name is Lifelines; the code names stay.
5. **Never skip or loosen a test to get green.** If a test encodes a decision
   that has changed, change the test and say why in the commit.

## UI work loop

Use the `frontend-craft` skill while building and `ux-review` before finishing.

```bash
npm run build                                        # → apps/
CHROMIUM_PATH=/opt/pw-browsers/chromium npm run shots   # → .shots/lifelines/
```

`shots` renders the local build at phone, tablet, laptop and desktop sizes,
in light and dark, with the panel open, search open and keyboard focus. It
writes `index.html` (contact sheet) and `report.md` (console errors). It
replays real data from `tests/e2e/data/lifelines-snapshot.json`, so it works
offline. Refresh that file with `scripts/lifelines-snapshot.sql` when the data
changes materially. Leave out `CHROMIUM_PATH` outside the cloud sandbox.

A UI change is done when:
- the affected screenshots (including dark) match DESIGN.md and the intent
- `ux-review` reports nothing at severity 3–4, or you've raised what's left
- unit, build and e2e pass (below), and lint is clean for files you touched
- DESIGN.md's "Known violations" is updated: fixed lines deleted, new ones added

## Checks

| What | Command | Where |
|---|---|---|
| Unit (Vitest) | `npm run test:unit` | root |
| Build | `npm run build` | root (builds `timeline-scratch` → `apps/`) |
| E2E (Playwright) | `npm run test:e2e` (needs `apps/`) | root |
| Lint | `npm run lint` | `timeline-scratch/` |

In the cloud sandbox, e2e needs the preinstalled browser. If Playwright asks
to install, check the version mismatch instead of downloading.

## Environment notes

- The cloud sandbox **cannot reach** Supabase, `*.pages.dev`, or Google
  Fonts. Use the snapshot and `shots` for rendering; use the Supabase
  connector (read-only queries) for live data questions.
- Cloudflare Pages binds environment variables at deploy time. A changed secret
  needs a redeploy. See `docs/lifelines-feedback-gate.md`.

## Commits and communication

- Commit messages follow the existing history: an imperative subject, then
  prose explaining *why*, what was found by rendering, and what was checked.
- The owner is technical but not a developer. Explain decisions and trade-offs
  in plain terms, and say what they need to click or decide. Don't explain
  syntax.
