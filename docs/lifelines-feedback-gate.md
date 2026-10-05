# Lifelines feedback gate — how it works, and what is left

Public feedback on the Lifelines timeline is open to newsletter subscribers.
This records how the pieces fit, the decisions that are not obvious from the
code, and what is still outstanding. Written at the end of the session that
built it, for whoever picks it up cold.

## The path a note takes

```
reader → Turnstile → POST /api/feedback/request-code → Resend emails a 6-digit code
       → POST /api/feedback/verify  → signed access token (30 days, localStorage)
       → POST /api/feedback         → App_Issues, source='public'
```

| Piece | Where |
|---|---|
| Shared crypto, DB helper, Turnstile verify | `functions/_lib/gate.js` |
| Ask for a code | `functions/api/feedback/request-code.js` |
| Redeem a code | `functions/api/feedback/verify.js` |
| Submit a note | `functions/api/feedback.js` |
| Three-step dialog | `timeline-scratch/src/components/Feedback/FeedbackButton.jsx` |
| Client service | `timeline-scratch/src/services/feedbackService.js` |
| Auto-enrol new subscribers | `workers/subscriber-intake/` (separate Worker) |

Tables: `Feedback_Subscribers` (`email_hmac` only), `Feedback_Access_Codes`,
and `App_Issues` for the notes themselves. The first two have RLS on with **no
policies at all**, so only the service-role key reaches them.

## Decisions that will look wrong until you know why

**`request-code` answers identically whether or not the address subscribes.**
Same status, same body, every time — including when the send fails. A "yes/no"
reply would turn it into an oracle for whether a named person reads a
church-history newsletter. That is a disclosure about them, not about us. The
property is asserted in the tests as a literal equality, not inferred from a
status code. The invitation to subscribe sits on that screen for everyone,
which both resolves the dead end for a non-subscriber and is the conversion.

**No plaintext address is ever stored.** Addresses are HMAC-SHA256 under a
server-side pepper (`FEEDBACK_SIGNING_SECRET`) with context labels, not plain
SHA-256: the space of real addresses is small enough to walk offline, and
without the pepper a dump yields nothing. A note carries
`page_context.subscriber_ref`, the first 16 hex of that digest — enough to see
that four hundred notes came from one account, useless for identifying who.

**Three implementations hash addresses** — Web Crypto in the Pages functions,
Web Crypto in the Worker, and `extensions.hmac` in Postgres for the SQL-editor
import route. If they ever disagree nothing throws; every address simply
hashes to something the gate cannot match, and the symptom is "no subscriber
ever gets a code". Their agreement is pinned by tests
(`subscriber-import-parity.test.js`, `subscriber-intake.test.js`). Do not add
a fourth without a test tying it to the others.

**Turnstile runs on `request-code` only, not on submit.** `request-code` is
what makes Resend send mail and nothing else guards it. The submit endpoint
already requires an access token obtainable only by receiving a code at a
subscribed address, which is a stronger claim than a captcha's. When the gate
is **off**, submit demands Turnstile again, because then no token exists and
the captcha is the only control — `functions/api/feedback.js` keys that on
`gateEnabled(env)`, and `FeedbackButton.jsx` mirrors it. **If those two ever
disagree, every submission fails.**

**Ten notes per subscriber per hour.** A token is reusable for thirty days, so
dropping the per-submission captcha removed an implicit rate limit that had to
be replaced explicitly. Counted per subscriber rather than per IP, because the
token is the identity we actually have. Fails open and logs, matching
`request-code`'s cap.

**The gate is a policy control, not the security boundary.** It fails open:
without `RESEND_API_KEY` and `FEEDBACK_SIGNING_SECRET` it switches off and
feedback behaves as it did before. The boundary is that `App_Issues` has no
anonymous insert policy at all — the browser cannot write to Supabase, only
the edge function can, with a key the client never sees.

## Operational notes

- **Pages binds environment variables at deploy time.** Changing a secret does
  nothing until a redeploy. This cost an hour: correct Turnstile keys sat in
  Production and the endpoint kept refusing tokens until a merge rebound them.
- **The Turnstile site key and secret are a pair, per widget.** A site key from
  one widget and a secret from another gives "Success!" in the browser and a
  403 from the server. The log now names it: `invalid-input-secret`.
- **Cloudflare's "Fix with Spin" wires server-side siteverify into a backend.**
  We already have it. Clicking it would produce a second implementation.
- The intake Worker deploys **separately** from Pages, via Workers Builds with
  root directory `workers/subscriber-intake`. Its secrets are its own and must
  match the Pages project byte for byte.
- Resend free tier: 3,000/month, 100/day.

## Outstanding

**1. ~~No e2e coverage of the feedback dialog.~~ Done in M4 (2026-10-05).**
`tests/e2e/church-history-2.spec.js` ("feedback, …") walks the ungated flow
with and without a captcha, the gated flow (email → code, a wrong code
refused, → write with no second captcha, the pass sent with the note), the
stored pass skipping straight to the note, and a lapsed pass (401) sending the
reader back to the email step. The endpoints are mocked, so the server side
of the captcha condition is still held by `feedback.js`'s unit tests; if the
two drift, one suite or the other goes red.

**2. Cloudflare rate-limiting rule on `/api/feedback`.** The per-subscriber cap
is in code; an edge rule would also bound unauthenticated hammering before it
reaches a function invocation. The Free plan allows one rule, which is enough.

**3. `CH_Sources` rows are editable but have no updater** in
`entityEditService`, so the inline pencil skips them. `source.id` is the real
`source_id`, so this is only missing service code.

**4. An admin upload page for the subscriber roll** would retire the SQL-editor
import route. Largely moot now that the Worker auto-enrols, but useful if a
bulk re-import is ever needed.

**5. Renaming "contested" to "Later disputed"** in the timeline's figure
classification, and faint century-boundary rules on the canvas — both deferred
cosmetic items from the 2.0 review rounds.
