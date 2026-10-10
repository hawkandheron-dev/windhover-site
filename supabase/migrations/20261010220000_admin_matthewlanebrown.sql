-- Make matthewlanebrown@gmail.com an admin (owner, 2026-10-10), so it gets
-- Lifelines' admin tools (Remove from view, Expanded view) alongside
-- hawkandheron.co@gmail.com. It was a contributor. The row is already
-- claimed by its production Clerk user, so it takes effect at next sign-in.
--
-- Idempotent: sets the value outright.

update users set role = 'admin' where email = 'matthewlanebrown@gmail.com';
