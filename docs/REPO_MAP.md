# Repo Map — profile-site

> Working rules for Claude: `/CLAUDE.md`. Lifelines design rules: `/DESIGN.md`. Skills: `.claude/skills/`.

Personal profile/portfolio site with several sub-projects: a static HTML landing page, an interactive church-history timeline (React + Vite + Supabase), and a pantheon database app (Next.js + Prisma) that can use Supabase in the broader platform and SQLite for local workflows. Hosted on Cloudflare Pages; auth via Clerk; primary shared data via Supabase with optional local SQLite in `pantheon-db`.

## Zones

- **`/` (root HTML)** — Static profile pages (`index.html`, `about.html`, `design-system.html`, `pantheons.html`, `pantheons-supabase.html`, `church-history-supabase.html`). Shared CSS (`style.css`, `supabase.css`, `editable-content.css`) and JS (`site.js`, `supabase-app.js`, `church-history-app.js`, `editable-content.js`). Changes here affect the public-facing static site.
- **`timeline-scratch/`** — React + Vite app. The main actively-developed timeline UI.
  - `src/components/Timeline/` — Canvas-based timeline renderer (zoom, pan, stacking).
  - `src/components/` — Feature UIs: `EditEntityForm/`, `Notes/`, `Suggestions/`, `VisionBoard/`, `IconStickerSheet/`.
  - `src/services/` — Supabase CRUD services (entities, notes, suggestions, favorites, Wikipedia, images, admin).
  - `src/data/` — Static data files and Supabase adapter.
  - `src/hooks/` — React hooks (e.g., `useFavorites`).
  - `src/lib/supabase.ts` — Supabase client init.
  - Multiple entry points: `main.jsx`, `main-church-history.jsx`, `main-church-history-supabase.jsx`, `main-historical-eras.jsx`.
  - **Typically changes**: components, services, data files.
  - **Careful with**: entry points, Supabase client config.
- **`pantheon-db/`** — Next.js 16 app with Prisma, supporting both Supabase-aligned data workflows and local SQLite development.
  - `prisma/schema.prisma` — DB schema. `prisma/seed.ts` — seed script.
  - `src/app/` — Next.js App Router pages and API routes (`api/`, `pantheons/`).
  - `src/lib/prisma.ts` — Prisma client singleton.
  - **Typically changes**: schema, pages, API routes.
  - **Careful with**: migrations, schema changes (need `prisma migrate`).
- **`supabase/`** — Supabase local config and SQL migrations.
  - `config.toml` — project config (project ID, ports).
  - `migrations/` — 20+ ordered SQL migrations (tables, RLS policies, seeds).
  - **Careful with**: migration order and naming; RLS policies.
- **`functions/api/`** — Cloudflare Pages Functions. Currently just `supabase-config.js` (serves env vars at runtime).
- **`data/`** — Raw data files (`works.csv`, `Pantheons/` subfolder).
- **`icons/`** — Icon assets organized by era (`classical/`, `medieval/`, `renaissance/`, `universal/`). Has `index.json` manifest.
- **`timeline/`** — Older standalone timeline (`app.js`, `events.json`, `index.html`). Likely legacy.
- **`scripts/`** — Utility scripts (`generate-seed-sql.mjs`; `lifelines-shots.mjs` renders Lifelines screenshots, `npm run shots`; `lifelines-snapshot.sql` refreshes its data).
- **`docs/`** — Documentation (`data-upload.md`, `lifelines-feedback-gate.md`, this file).
- **`functions/`** — Cloudflare Pages Functions (the feedback gate's endpoints; `_lib/` is excluded from routing by its underscore).
- **`workers/`** — Standalone Workers deployed separately from Pages (`subscriber-intake/`, an Email Worker).
- **`.github/workflows/`** — CI: `ci.yml` (unit, build, e2e) and `supabase-migrations.yml`.

## Run / Build / Deploy

| Command | Where | What |
|---|---|---|
| `npm run build` | root | Runs `cd timeline-scratch && npm install && npm run build` |
| `npm run dev` | `timeline-scratch/` | Vite dev server (port 5173) |
| `npm run build` | `timeline-scratch/` | Vite production build → `dist/` |
| `npm run lint` | `timeline-scratch/` | ESLint |
| `npm run dev` | `pantheon-db/` | Next.js dev server (port 3000) |
| `npm run build` | `pantheon-db/` | Next.js production build |
| `npm run lint` | `pantheon-db/` | ESLint |

Deploy: Cloudflare Pages (static root + `functions/`). The `timeline-scratch/dist/` output is the built SPA.

## Env & Secrets

### `timeline-scratch/.env`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ENABLE_DEBUG` (optional, shows debug panel)

### `pantheon-db/.env`
- `DATABASE_URL` (local SQLite path, e.g., `file:./dev.db`, when using local mode)

### Supabase-backed pantheon flows
- Supabase schema and data live in `supabase/migrations/` and are used by the broader pantheon/church-history experiences
- Root pages (`pantheons-supabase.html`, `supabase-app.js`) and timeline apps consume Supabase directly

### Cloudflare Pages (runtime)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CLERK_PUBLISHABLE_KEY` — served via `functions/api/supabase-config.js`

### Root static pages
- `supabase-config.js` — local fallback sets `window.SUPABASE_URL`, `window.SUPABASE_ANON_KEY`, `window.CLERK_PUBLISHABLE_KEY`

## Data / Auth / Integrations

- **Auth**: Clerk (JWT-based). Used in `timeline-scratch` and root static pages.
- **Database (remote)**: Supabase (PostgreSQL). Tables include: pantheon entities, church-history events/people/periods, notes, suggestions, era_favorites, site_content, users. RLS enforced via `clerk_user_id = auth.jwt() ->> 'sub'`.
- **Database (local option)**: Prisma + SQLite in `pantheon-db/` for local/standalone development.
- **Maps**: MapLibre GL + OpenHistoricalMap in `timeline-scratch`.
- **CI**: GitHub Actions runs Supabase migrations (`supabase-migrations.yml`).

## Common Tasks

1. **Add a timeline component** — Create in `timeline-scratch/src/components/`, import in the relevant App file.
2. **Add/edit Supabase migration** — Add numbered SQL file in `supabase/migrations/` (format: `YYYYMMDDHHMMSS_description.sql`).
3. **Update RLS policy** — Edit or add migration in `supabase/migrations/`. Follow existing `clerk_user_id` JWT pattern.
4. **Add a Supabase service** — Create in `timeline-scratch/src/services/`, use `supabase` client from `src/lib/supabase.ts`.
5. **Update pantheon-db schema** — Edit `pantheon-db/prisma/schema.prisma`, run `npx prisma migrate dev`.
6. **Add a static page** — Create HTML file at root, link from `index.html`. Use `style.css` and `site.js`.
7. **Add icons** — Place in `icons/<era>/`, update `icons/index.json`.
8. **Add a Cloudflare Pages Function** — Create in `functions/api/`.

## Big / Expensive to Read

- `node_modules/` (all sub-projects)
- `dist/` (build output)
- `highcountry_1.png` (~15 MB), `profile_photo.png` (~5 MB)
- `pantheon-db/package-lock.json`, `timeline-scratch/package-lock.json`
- `timeline-scratch/src/assets/bg-manuscript.jpg`
- `supabase/migrations/` — read individual files only when needed, not all at once
- `screenshots/`

## Conventions

- **Supabase migrations**: named `YYYYMMDDHHMMSS_description.sql`, applied in order.
- **Linting**: ESLint in both `timeline-scratch` and `pantheon-db`.
- **timeline-scratch**: React JSX (`.jsx`), some TypeScript (`.ts`/`.tsx`) for newer files (hooks, services, lib).
- **pantheon-db**: TypeScript throughout.
- **Static pages**: Plain HTML + vanilla JS + CSS. Supabase client loaded via `<script>` tags.
- **No monorepo tooling**: Each sub-project has its own `package.json` and `node_modules`.
