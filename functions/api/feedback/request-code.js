/**
 * Step one of the subscriber gate: ask for a code.
 *
 * THE CENTRAL PROPERTY: this endpoint answers identically whether or not the
 * address is a subscriber. Same status, same body, every time. A "yes/no"
 * reply would turn it into an oracle — anyone could test whether a given
 * person subscribes to a church-history publication, which is a disclosure
 * about that person's reading, not about us. Only the inbox differs.
 *
 * That is also why a failure to SEND is not reported either: telling the
 * caller "we couldn't email you" confirms there was something to email.
 * Send failures are logged and swallowed.
 */
import {
  gateEnabled, hashEmail, hashCode, generateCode, db, json, verifyTurnstile,
} from '../../_lib/gate.js';

const CODE_TTL_MS = 10 * 60 * 1000;          // ten minutes
const MAX_CODES_PER_HOUR = 5;                 // per address, not per IP

/** The one response this endpoint ever gives on the happy path. */
const ACCEPTED = () => json(202, {
  status: 'sent_if_subscribed',
  message: 'If that address is subscribed, a code is on its way.',
});

async function sendCodeEmail(env, email, code) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      // The sender address. It needs no mailbox — Resend may send from any
      // address at a verified domain — but pointing it at one that Cloudflare
      // Email Routing forwards means a reply reaches a human instead of
      // bouncing.
      from: env.VERIFICATION_FROM_EMAIL || 'Lifelines <admin@windhoverhistory.com>',
      to: [email],
      subject: `${code} is your Lifelines feedback code`,
      text: [
        `Your code is ${code}`,
        '',
        'It is good for ten minutes and can be used once.',
        'If you did not ask for this, you can ignore it — nothing has been sent on your behalf.',
      ].join('\n'),
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST' } });
  }
  if (!gateEnabled(env)) return json(503, { error: 'The subscriber gate is not configured.' });

  let payload;
  try { payload = await request.json(); } catch { return json(400, { error: 'Expected a JSON body.' }); }

  const email = String(payload?.email || '').trim();
  const token = String(payload?.token || '');

  // Shape checks are safe to report: they say nothing about who subscribes.
  if (!email || !email.includes('@') || email.length > 320) {
    return json(400, { error: 'Please enter a valid email address.' });
  }
  if (!token) return json(400, { error: 'Please complete the challenge.' });

  // Checked here as well as in gateEnabled, which deliberately keys only on
  // the two secrets that decide whether the gate exists at all. Without this,
  // an absent TURNSTILE_SECRET_KEY reaches the verifier, comes back
  // missing-input-secret, and the reader is told THEY failed a human check —
  // blaming a person for a variable nobody set. /api/feedback already fails
  // closed this way; the two endpoints should not disagree.
  if (!env.TURNSTILE_SECRET_KEY || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('gate: missing env', {
      turnstile: Boolean(env.TURNSTILE_SECRET_KEY),
      url: Boolean(env.SUPABASE_URL),
      serviceRole: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    });
    return json(503, { error: 'Feedback is not configured right now.' });
  }

  const verdict = await verifyTurnstile(
    token, env.TURNSTILE_SECRET_KEY, request.headers.get('CF-Connecting-IP'));
  if (!verdict.ok) {
    // The reason is the whole point: invalid-input-secret means the secret
    // does not pair with the site key, timeout-or-duplicate means the token
    // was stale or already spent. Without it every failure looks the same.
    console.warn('gate: turnstile rejected', verdict.reason);
    return json(403, { error: 'Could not verify that you are human. Please try again.' });
  }

  const secret = env.FEEDBACK_SIGNING_SECRET;
  const emailHash = await hashEmail(secret, email);

  // Everything from here returns ACCEPTED, whatever happens.
  try {
    const since = new Date(Date.now() - 3600_000).toISOString();
    const recent = await db(env,
      `Feedback_Access_Codes?email_hmac=eq.${emailHash}&created_at=gte.${since}&select=code_hmac`);
    if (recent.ok && (await recent.json()).length >= MAX_CODES_PER_HOUR) {
      // Over the cap. Same answer as always — a different one would reveal
      // that this address is worth hammering.
      console.warn('gate: code request rate limit hit');
      return ACCEPTED();
    }

    const known = await db(env, `Feedback_Subscribers?email_hmac=eq.${emailHash}&select=email_hmac`);
    if (!known.ok || (await known.json()).length === 0) return ACCEPTED();

    const code = generateCode();
    const insert = await db(env, 'Feedback_Access_Codes', {
      method: 'POST',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({
        code_hmac: await hashCode(secret, code),
        email_hmac: emailHash,
        expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
      }),
    });
    if (!insert.ok) {
      console.error('gate: could not store code', insert.status, await insert.text());
      return ACCEPTED();
    }

    await sendCodeEmail(env, email, code);
  } catch (err) {
    // Including a send failure: saying "we could not email you" would confirm
    // there was an address worth emailing.
    console.error('gate: request-code failed', err?.message);
  }

  return ACCEPTED();
}
