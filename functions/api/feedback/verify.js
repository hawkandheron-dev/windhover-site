/**
 * Step two of the subscriber gate: redeem a code for an access token.
 *
 * Unlike request-code, this one may say "that code is wrong" — by the time
 * someone holds a code they have already proved inbox access, so the reply
 * discloses nothing about who subscribes.
 *
 * A code is single-use, expires in ten minutes, and dies after a handful of
 * wrong guesses. Six digits is a million possibilities, which is plenty when
 * guesses are capped and the window is short, and far friendlier to type on a
 * phone than a long opaque string.
 */
import { gateEnabled, hashEmail, hashCode, issueToken, db, json } from '../../_lib/gate.js';

const MAX_ATTEMPTS = 5;
const TOKEN_TTL_DAYS = 30;

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST' } });
  }
  if (!gateEnabled(env)) return json(503, { error: 'The subscriber gate is not configured.' });

  let payload;
  try { payload = await request.json(); } catch { return json(400, { error: 'Expected a JSON body.' }); }

  const email = String(payload?.email || '').trim();
  const code = String(payload?.code || '').trim();
  if (!email || !/^\d{6}$/.test(code)) {
    return json(400, { error: 'Please enter the six-digit code from your email.' });
  }

  const secret = env.FEEDBACK_SIGNING_SECRET;
  const emailHash = await hashEmail(secret, email);
  const codeHash = await hashCode(secret, code);

  // Matched on BOTH hashes: a code is only valid for the address it was sent
  // to, so one subscriber's code cannot admit a different address.
  const res = await db(env,
    `Feedback_Access_Codes?code_hmac=eq.${codeHash}&email_hmac=eq.${emailHash}` +
    `&select=code_hmac,expires_at,consumed_at,attempts`);
  if (!res.ok) {
    console.error('gate: code lookup failed', res.status);
    return json(502, { error: 'Could not check that code. Please try again.' });
  }

  const [row] = await res.json();

  // A wrong code has no row to count attempts against, so the attempt cap
  // lives on the code that WAS issued: fetch the live one for this address and
  // charge the guess to it. Without this, guesses would be uncapped.
  if (!row) {
    await chargeFailedAttempt(env, emailHash);
    return json(400, { error: 'That code is not right, or it has expired.' });
  }

  if (row.consumed_at) return json(400, { error: 'That code has already been used.' });
  if (new Date(row.expires_at) < new Date()) return json(400, { error: 'That code has expired.' });
  if (row.attempts >= MAX_ATTEMPTS) return json(429, { error: 'Too many attempts. Please request a new code.' });

  const consume = await db(env, `Feedback_Access_Codes?code_hmac=eq.${codeHash}`, {
    method: 'PATCH',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify({ consumed_at: new Date().toISOString() }),
  });
  // Burn before issuing: if the update failed we do not know the code is still
  // unused, and handing out a token on an unconfirmed burn makes it reusable.
  if (!consume.ok || (await consume.json()).length === 0) {
    return json(409, { error: 'That code has already been used.' });
  }

  return json(200, {
    token: await issueToken(secret, emailHash, TOKEN_TTL_DAYS),
    expiresInDays: TOKEN_TTL_DAYS,
  });
}

async function chargeFailedAttempt(env, emailHash) {
  try {
    const live = await db(env,
      `Feedback_Access_Codes?email_hmac=eq.${emailHash}&consumed_at=is.null` +
      `&order=created_at.desc&limit=1&select=code_hmac,attempts`);
    if (!live.ok) return;
    const [row] = await live.json();
    if (!row) return;
    await db(env, `Feedback_Access_Codes?code_hmac=eq.${row.code_hmac}`, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({ attempts: row.attempts + 1 }),
    });
  } catch (err) {
    console.error('gate: could not record failed attempt', err?.message);
  }
}
