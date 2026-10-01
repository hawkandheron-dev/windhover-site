-- Unauthenticated feedback for Lifelines.
--
-- Anyone can leave a note without signing in. The rows land in the existing
-- App_Issues table so they appear in the admin triage view already built for
-- contributor-submitted issues, rather than in a second place nobody checks.
--
-- Two things that make an anonymous write safe to expose:
--
--   1. A `source` column separates public notes from contributor issues, so a
--      flood of the former never buries the latter.
--   2. The insert policy constrains the WHOLE row, not just who may write it.
--      An anonymous client can set the message and nothing else — no status,
--      no resolver fields, no attribution to a signed-in user.
--
-- Anonymous reads are NOT granted. Feedback can contain anything a stranger
-- types, so only admins can read it back.
--
-- Worth stating plainly: this is a public write endpoint, and the anon key is
-- in the client by design. The length bounds below cap the damage of a single
-- request, but nothing here stops a determined script from inserting many
-- rows. Real rate limiting needs a captcha or an edge function in front, which
-- is a follow-up, not something RLS can express.

begin;

-- ── 1. Columns ───────────────────────────────────────────────────────────────

-- Anonymous submitters have no Clerk id.
alter table public."App_Issues" alter column submitted_by drop not null;

alter table public."App_Issues"
  add column if not exists source text not null default 'contributor'
    check (source in ('contributor', 'public'));

create index if not exists app_issues_source_status_idx
  on public."App_Issues" (source, status);

-- ── 2. Anonymous insert ──────────────────────────────────────────────────────

drop policy if exists "Anyone can submit public feedback" on public."App_Issues";
create policy "Anyone can submit public feedback" on public."App_Issues"
  for insert
  to anon, authenticated           -- signed-out and signed-in alike
  with check (
    source = 'public'
    and submitted_by is null       -- never attributable to someone else
    and issue_type = 'general'
    -- 'submitted' is the column default and the first value in the status
    -- vocabulary (submitted → in_review → on_roadmap → implemented /
    -- not_going_to_do). Pinning it means a note cannot arrive pre-triaged.
    and status = 'submitted'
    and resolver_notes is null
    and resolved_by is null
    and resolved_at is null
    and screenshot_urls = '{}'
    and page_context is null
    and app_id = 'ch-timeline-2'   -- only this page's widget
    and char_length(title) between 1 and 120
    and char_length(description) between 1 and 4000
  );

-- The existing contributor policy requires `submitted_by` to equal the caller's
-- JWT subject, so dropping NOT NULL above does not let a signed-in user submit
-- an unattributed issue through that path. Recreated here only to pin
-- source = 'contributor' on it, keeping the two streams distinct.
drop policy if exists "Contributors can insert issues" on public."App_Issues";
create policy "Contributors can insert issues" on public."App_Issues"
  for insert with check (
    exists (
      select 1 from public.users
      where clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        and role in ('contributor', 'admin')
    )
    and submitted_by = current_setting('request.jwt.claims', true)::json->>'sub'
    and source = 'contributor'
  );

commit;
