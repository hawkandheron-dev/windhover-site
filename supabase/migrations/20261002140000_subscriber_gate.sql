-- Substack subscriber gate for public feedback.
--
-- Feedback is for subscribers. Not as a security control — anyone can
-- subscribe free with a throwaway address — but because it makes a spike
-- visible and attributable in a list that can be eyeballed, and turns a
-- feedback box into a subscription funnel. Turnstile remains the thing that
-- actually stops scripts.
--
-- NO PLAINTEXT ADDRESS IS STORED. Both tables hold HMAC-SHA256 digests taken
-- under a server-side pepper. A plain hash would be inadequate: the space of
-- real addresses is small enough to enumerate offline, so a dump plus a guess
-- list would recover the subscriber roll. Without the pepper, an HMAC does not.
--
-- Neither table carries ANY policy. RLS is enabled and nothing is granted, so
-- the anon and authenticated roles cannot read or write them at all; only the
-- service-role key used by the Pages Functions reaches them. That is the whole
-- access model, and it is deliberately the most restrictive one available.

begin;

-- ── Subscribers ──────────────────────────────────────────────────────────────

create table if not exists public."Feedback_Subscribers" (
  email_hmac  text primary key,
  added_at    timestamptz not null default now()
);

comment on table public."Feedback_Subscribers" is
  'Substack subscribers permitted to submit feedback. HMAC digests only — never plaintext addresses. Loaded from the Substack CSV export by scripts/import-subscribers.mjs.';

alter table public."Feedback_Subscribers" enable row level security;
-- No policies, on purpose. Service role only.

-- ── One-time codes ───────────────────────────────────────────────────────────

create table if not exists public."Feedback_Access_Codes" (
  code_hmac    text primary key,
  email_hmac   text not null,
  expires_at   timestamptz not null,
  consumed_at  timestamptz,
  attempts     integer not null default 0,
  created_at   timestamptz not null default now()
);

comment on table public."Feedback_Access_Codes" is
  'Short-lived one-time codes emailed to subscribers. Codes are stored hashed, so a dump does not yield a working code.';

-- Lookup by address when rate-limiting requests, and for expiry sweeps.
create index if not exists feedback_codes_email_idx
  on public."Feedback_Access_Codes" (email_hmac, created_at desc);
create index if not exists feedback_codes_expiry_idx
  on public."Feedback_Access_Codes" (expires_at);

alter table public."Feedback_Access_Codes" enable row level security;
-- No policies here either.

commit;
