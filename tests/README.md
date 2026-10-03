# Test Suite

Overview of every test that runs in CI. See `.github/workflows/ci.yml`
for how they're wired, and `tests/e2e/fixtures.js` for the shared
Playwright mocks.

## When tests run

- **Unit** (Vitest + jsdom): on every push to `main` and every PR.
  Local: `npm run test:unit`.
- **Build** (Vite): same triggers. Produces the `apps/` artifact that
  `e2e` consumes. Local: `npm run build`.
- **E2E** (Playwright, chromium only): same triggers; depends on the
  build job. Local: `npm run test:e2e` (requires `apps/` to exist —
  run `npm run build` first).

All tests use mocked dependencies — no live Supabase or Clerk, no
shared state.

---

## Unit tests (`tests/unit/`)

### `auth-helpers.test.js`

Covers the pure helpers extracted to `auth-helpers.js`. These run
synchronously in jsdom; no DOM or network.

| # | Scenario | Asserts |
|---|---|---|
| 1 | `pk_test_` key decodes | `getFrontendApi('pk_test_<base64>')` returns the embedded hostname. |
| 2 | `pk_live_` key decodes | Same behaviour for production-tier keys. |
| 3 | Trailing `$` stripped | `getFrontendApi` removes the trailing `$` that Clerk's encoded hostnames include. |
| 4 | No trailing `$` | A hostname without `$` round-trips unchanged. |
| 5 | `waitForConfig` happy path | Resolves once `getGlobals` returns both a URL and key, well before the timeout. |
| 6 | `waitForConfig` timeout | Rejects with a "Supabase config not loaded within Nms" error when globals never appear. |
| 7 | Partial config — URL only | Rejects; half a config is still broken. |
| 8 | Partial config — key only | Rejects; mirror of #7. |

### `editable-content-bootstrap.test.js`

Integration tests that load the `editable-content.js` IIFE into jsdom
with different `window` states and assert on the resulting DOM.

| # | Scenario | Asserts | Why it matters |
|---|---|---|---|
| 1 | Empty `CLERK_PUBLISHABLE_KEY` | A `button#ec-sign-in-btn[disabled]` with text "Sign-in unavailable" appears in `.top-nav` and `console.error` mentions `CLERK_PUBLISHABLE_KEY missing`. | Makes a missing env var visibly distinct from a working signed-out state. |
| 2 | **Regression — parallel init** | Supabase fetch is mocked to hang (unresolving promise). The auth UI still mounts within ~50ms. | Prevents re-introducing the original "Sign In doesn't appear when Supabase is slow" symptom. Reverting the `Promise.allSettled` change in `editable-content.js` makes this test fail. |
| 3 | `waitForConfig` timeout | With `SUPABASE_URL`/`ANON_KEY` never set and a tiny 30ms timeout, the disabled button appears with title "Site config unavailable" and `console.error` mentions "Supabase config not loaded". | Catches a broken `/api/supabase-config` (e.g. Pages Function misconfiguration). |

---

## E2E tests (`tests/e2e/smoke.spec.js`)

Chromium-only Playwright tests served via `npx serve` against the repo
root. All external requests (`/api/supabase-config`, `*.supabase.co`,
Clerk JS CDN) are intercepted by `page.route()` — see
`tests/e2e/fixtures.js`.

### `home page auth bootstrap`

These load `/home.html`: the site root became Lifelines in milestone 2 (see `_redirects`). In the cloud sandbox they fail because the page loads Supabase from a CDN the sandbox cannot reach; they pass in CI and with that request served locally.

| # | Scenario | Asserts |
|---|---|---|
| 1 | Happy path | With valid mocked config, mocked Supabase, and a stubbed Clerk JS, `#ec-sign-in-btn` is visible, enabled, and its text matches `/Sign In\|Sign Up/`. |
| 2 | Missing Clerk key | With `CLERK_PUBLISHABLE_KEY: ''`, the disabled "Sign-in unavailable" button appears, **no** request is made to the Clerk CDN, and a console.error mentions `CLERK_PUBLISHABLE_KEY missing`. |
| 3 | **Regression — parallel init** | The Supabase `site_content` endpoint is delayed 5 seconds. The auth button is asserted visible within 1.5s and the whole test completes in under 2s — proving Sign In does not serialize behind the CMS fetch. |

### `build outputs`

| # | Scenario | Asserts |
|---|---|---|
| 4 | Landing-nav integrity | Parses every `href="apps/*.html"` out of `home.html` (the former landing page, formerly `index.html`) and asserts each target file exists under `apps/` on disk. Catches the "renamed a Vite entry without rebuilding" class of bug that started this whole investigation. |

### `CH Timeline page`

| # | Scenario | Asserts |
|---|---|---|
| 5 | Page loads and React mounts | `GET /apps/church-history-timeline.html` returns 200 and `#root` has at least one child element within 10s. Skipped (with a message) if `apps/` hasn't been built. |

---

## What this suite does **not** cover

Intentional gaps, each deferred to a follow-up PR when the need is
concrete:

- **React component behaviour** beyond "renders at all" — e.g.
  `ChurchHistorySupabaseApp` admin gating, `Timeline` rendering logic,
  the Getting Started flow. Needs Vitest + React Testing Library in
  `timeline-scratch/`.
- **Pages Function correctness** — `functions/api/supabase-config.js`
  runs in workerd, not Node. Needs `@cloudflare/vitest-pool-workers`.
- **API failure-mode tests** — e.g. "Supabase returns 500", "Clerk
  rate-limits us". Playwright route interception works, but a dedicated
  MSW setup in unit/component tests would let us test these without
  spinning up a browser.
- **Production monitoring.** Tests run in CI, not against the live site.
  A slow edge POP (the original symptom that prompted all this) can
  only be caught by synthetic uptime checks — Cloudflare Health Checks,
  UptimeRobot, or similar, hitting the prod URL every few minutes.

---

## Adding a new test

- **Pure-function behaviour** → add to `tests/unit/auth-helpers.test.js`
  (or a sibling unit file for a new module).
- **Bootstrap / DOM integration that doesn't need a browser** → add to
  `tests/unit/editable-content-bootstrap.test.js` (or a sibling) using
  the same `loadEditableContent` / `resetGlobals` pattern.
- **Full-page behaviour** → add to `tests/e2e/smoke.spec.js` (or a new
  spec file in `tests/e2e/`). Reuse mocks from `tests/e2e/fixtures.js`;
  prefer adding new ones there over inlining routes per-test.
- Keep regression tests labelled with a `Regression —` prefix so future
  maintainers know which tests protect against specific historical bugs.
