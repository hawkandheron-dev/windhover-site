/**
 * Public feedback endpoint.
 *
 * This exists so that the browser does not write to the database. A reader's
 * note arrives here with a Turnstile token; this function verifies the token
 * with Cloudflare, and only then inserts — using a service-role key that never
 * leaves the server. Once the matching RLS policy is dropped, there is no way
 * for an anonymous browser to insert a row at all, which is the point: the
 * captcha is not a guard in front of an open door, it replaces the door.
 *
 * Secrets, both Pages environment variables and neither ever sent to a client:
 *   TURNSTILE_SECRET_KEY      — verifies the captcha token
 *   SUPABASE_SERVICE_ROLE_KEY — bypasses RLS, so it must stay server-side
 *
 * The response body is deliberately thin. A caller learns whether their note
 * was accepted and nothing about the database behind it.
 */

import {
  gateEnabled, verifyToken, verifyTurnstile,
} from '../_lib/gate.js';

const APP_ID = 'ch-timeline-2';
const MAX_MESSAGE = 4000;
const MAX_TITLE = 120;

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

/** Mirrors deriveTitle in feedbackService.js: App_Issues.title is NOT NULL. */
function deriveTitle(message) {
  const firstLine = message.trim().split('\n')[0].trim();
  if (firstLine.length <= MAX_TITLE) return firstLine;
  const clipped = firstLine.slice(0, MAX_TITLE - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}


/**
 * One handler, branching on method itself, rather than exporting both
 * onRequest and onRequestPost and relying on which takes precedence.
 */
export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST' } });
  }

  const { TURNSTILE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } = env;

  // Fail closed and loudly in the log, rather than silently accepting notes
  // without a captcha because a variable was never set.
  if (!TURNSTILE_SECRET_KEY || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_URL) {
    console.error('feedback: missing env', {
      turnstile: Boolean(TURNSTILE_SECRET_KEY),
      serviceRole: Boolean(SUPABASE_SERVICE_ROLE_KEY),
      url: Boolean(SUPABASE_URL),
    });
    return json(503, { error: 'Feedback is not configured right now.' });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: 'Expected a JSON body.' });
  }

  const message = typeof payload?.message === 'string' ? payload.message.trim() : '';
  const token = typeof payload?.token === 'string' ? payload.token : '';
  const accessToken = typeof payload?.accessToken === 'string' ? payload.accessToken : '';

  if (!message) return json(400, { error: 'Please write something first.' });
  if (message.length > MAX_MESSAGE) {
    return json(400, { error: `Please keep it under ${MAX_MESSAGE} characters.` });
  }
  // Only demanded when Turnstile is the control — see the gate check below.
  // With the gate on the client renders no widget here and sends no token, so
  // insisting on one would refuse every submission.
  if (!gateEnabled(env) && !token) {
    return json(400, { error: 'Please complete the challenge.' });
  }

  // The subscriber gate, when it is switched on. Checked before Turnstile so
  // an unsubscribed caller is not made to solve a puzzle only to be refused.
  // When the gate is off (its secrets absent) feedback behaves as it did
  // before — Turnstile alone — because the gate decides WHO may use the
  // feature while Turnstile and the closed RLS policy are the security
  // boundary. See functions/_lib/gate.js.
  let subscriber = null;
  if (gateEnabled(env)) {
    subscriber = await verifyToken(env.FEEDBACK_SIGNING_SECRET, accessToken);
    if (!subscriber) {
      return json(401, { error: 'Please confirm your subscriber email before sending feedback.' });
    }
  }

  // Turnstile is required here ONLY when the gate is off.
  //
  // With the gate on, this request already carries a signed access token that
  // could only have been obtained by receiving a six-digit code at a
  // subscribed address. That is a strictly stronger claim than a captcha's: a
  // captcha says a human is present, the token says a verified subscriber is.
  // Asking for both made a returning reader solve a puzzle on every note, for
  // no gain, and the double prompt is what the gate's own design was meant to
  // spare them.
  //
  // With the gate off there is no token, so Turnstile is the only thing
  // between a script and this endpoint, and it stays mandatory. Failing that
  // way round matters: the weaker configuration must not be the one that
  // drops a control.
  //
  // request-code keeps its own Turnstile regardless. It is what makes Resend
  // send mail, and nothing else guards it.
  if (!gateEnabled(env)) {
    const verdict = await verifyTurnstile(
      token,
      TURNSTILE_SECRET_KEY,
      request.headers.get('CF-Connecting-IP')
    );
    if (!verdict.ok) {
      console.warn('feedback: turnstile rejected', verdict.reason);
      return json(403, { error: 'Could not verify that you are human. Please try again.' });
    }
  }

  // Past the captcha. Insert with the service-role key, pinning every column
  // the old RLS policy used to pin — the shape of a public note should not
  // depend on where it was enforced.
  const res = await fetch(`${SUPABASE_URL}/rest/v1/App_Issues`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify({
      app_id: APP_ID,
      title: deriveTitle(message),
      description: message,
      issue_type: 'general',
      status: 'submitted',
      source: 'public',
      submitted_by: null,
      // Which subscriber, as a truncated address hash — never the address.
      // Enough to see that four hundred notes came from one account; not
      // enough to learn whose. It goes in page_context rather than
      // submitted_by because that column means "clerk_user_id" everywhere
      // else, and the admin view resolves it against the users table.
      page_context: subscriber ? { subscriber_ref: subscriber.emailHash.slice(0, 16) } : null,
    }),
  });

  if (!res.ok) {
    // Log the detail, return none of it: a stranger should not learn the
    // schema from an error message.
    console.error('feedback: insert failed', res.status, await res.text());
    return json(502, { error: 'Could not save your note. Please try again.' });
  }

  return json(201, { ok: true });
}
