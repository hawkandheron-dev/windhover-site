/**
 * Shared crypto and storage helpers for the subscriber gate.
 *
 * Lives under functions/_lib/ because Cloudflare Pages excludes paths starting
 * with an underscore from routing — this is a module, not an endpoint.
 *
 * Two rules shape everything here:
 *
 *   No plaintext address ever reaches the database. Addresses are stored and
 *   compared as HMAC-SHA256 under a server-side pepper. A plain hash would not
 *   do: the space of real email addresses is small enough to walk, so an
 *   attacker holding a dump could confirm guesses offline. Without the pepper
 *   an HMAC gives them nothing.
 *
 *   One secret, several uses. FEEDBACK_SIGNING_SECRET is used with distinct
 *   context labels so the email pepper and the token signature are
 *   cryptographically independent despite sharing a dashboard entry. Reusing a
 *   key across purposes without separation is how one leak becomes two.
 */

const enc = new TextEncoder();

async function hmac(secret, label, value) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(`${label}:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Normalise an address the same way at import and at lookup.
 *
 * Lowercase and trim only. Deliberately NOT stripping dots or +tags: those
 * rules are provider-specific, and a subscriber whose Substack address carries
 * a +tag should match on exactly what they typed rather than on our guess
 * about their mail provider.
 */
export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export const hashEmail = (secret, email) => hmac(secret, 'email-v1', normalizeEmail(email));
export const hashCode  = (secret, code)  => hmac(secret, 'code-v1', String(code));

/** A 6-digit code from a CSP RNG — never Math.random for anything that gates. */
export function generateCode() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1_000_000).padStart(6, '0');
}

/**
 * Access token: "<expiry>.<emailHash>.<signature>".
 *
 * Deliberately not a JWT — there is no third party to interoperate with, and a
 * hand-rolled format with one algorithm cannot be talked into `alg: none`.
 */
export async function issueToken(secret, emailHash, ttlDays = 30) {
  const exp = Date.now() + ttlDays * 86_400_000;
  const payload = `${exp}.${emailHash}`;
  return `${payload}.${await hmac(secret, 'token-v1', payload)}`;
}

export async function verifyToken(secret, token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;

  const [exp, emailHash, sig] = parts;
  const expected = await hmac(secret, 'token-v1', `${exp}.${emailHash}`);

  // Constant-time compare: a length-and-content check that returns early
  // leaks, by timing, how much of a forged signature was right.
  if (!timingSafeEqual(sig, expected)) return null;
  if (!Number(exp) || Number(exp) < Date.now()) return null;

  return { emailHash, exp: Number(exp) };
}

export function timingSafeEqual(a, b) {
  const x = String(a), y = String(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

/**
 * Whether the gate is switched on.
 *
 * Absent its secrets the gate is OFF and feedback behaves as it did before —
 * Turnstile alone. That is a deliberate choice: the gate decides WHO may use
 * the feature, while Turnstile and the closed RLS policy are what keep the
 * system safe. Failing a policy control open is reasonable; failing the
 * security boundary open would not be, and this never touches it.
 */
export const gateEnabled = (env) =>
  Boolean(env.RESEND_API_KEY && env.FEEDBACK_SIGNING_SECRET);

/** Thin PostgREST helper; the service-role key bypasses RLS by design. */
export async function db(env, path, init = {}) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

export const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

/** Cloudflare's token verification endpoint. */
const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verify a Turnstile token server-side.
 *
 * Returns {ok, reason} rather than a bare boolean, and the reason matters:
 * Cloudflare says exactly why it refused — invalid-input-secret (the secret
 * does not pair with the site key), timeout-or-duplicate (the token is stale
 * or already spent), missing-input-secret (no secret was sent at all) — and
 * every one of those is a different fix. Discarding it leaves a reader told
 * they failed a human check and an operator with nothing to go on.
 *
 * Lives here because both endpoints need it and the two copies had already
 * drifted: this one kept the error codes, the other threw them away.
 */
export async function verifyTurnstile(token, secret, remoteip) {
  const form = new URLSearchParams({ secret: secret || '', response: token || '' });
  // Cloudflare treats remoteip as optional; send it when the edge gave us one.
  if (remoteip) form.set('remoteip', remoteip);

  let res;
  try {
    res = await fetch(TURNSTILE_VERIFY, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
    });
  } catch (err) {
    // A verifier we cannot reach is a failed challenge, never a pass.
    return { ok: false, reason: `verify-unreachable: ${err?.message || 'fetch failed'}` };
  }

  if (!res.ok) return { ok: false, reason: `verify-http-${res.status}` };

  const data = await res.json().catch(() => ({}));
  return data.success
    ? { ok: true }
    : { ok: false, reason: (data['error-codes'] || []).join(',') || 'verify-failed' };
}
