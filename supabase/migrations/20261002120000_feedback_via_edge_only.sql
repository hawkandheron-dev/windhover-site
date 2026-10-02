-- Close the public write endpoint.
--
-- Public feedback used to insert straight from the browser under an anonymous
-- RLS policy. The policy constrained the row tightly and there was no
-- anonymous read, so the worst a stranger could do was leave notes — but
-- nothing in RLS can stop a script leaving a hundred thousand of them.
--
-- Notes now arrive through functions/api/feedback.js, which verifies a
-- Turnstile token and inserts with the service-role key. Dropping this policy
-- is what makes that the ONLY route: afterwards the anon key cannot write to
-- App_Issues at all, so the captcha is not a guard in front of an open door.
--
-- Deploy order matters. The function must be live before this runs, or the
-- feedback box breaks in the gap. Rolling back means recreating the policy
-- from 20261001140000_public_feedback.sql.

begin;

drop policy if exists "Anyone can submit public feedback" on public."App_Issues";

commit;
