/**
 * Public feedback — a note anyone can leave, signed in or not.
 *
 * The browser no longer writes to the database. It posts to /api/feedback, a
 * Cloudflare Pages Function that verifies a Turnstile token and then inserts
 * server-side with a key the client never sees. The matching anonymous insert
 * policy is dropped, so this endpoint is not a guard in front of an open door
 * — it is the only door.
 *
 * Notes land in App_Issues alongside contributor-reported issues, tagged
 * source='public', so they appear in the admin triage view already built.
 */

/** Matches the bound enforced by the function and by the column. */
export const FEEDBACK_MAX_LENGTH = 4000;

/** App_Issues.title is NOT NULL; the server derives the same way. */
const TITLE_MAX_LENGTH = 120;

/**
 * A title is required by the schema but not by the reader, who is given one
 * box and told to write in it. Take the first line so the admin list is
 * scannable without asking for a second field.
 *
 * Kept here as well as on the server because it is the server's value that is
 * stored — this one exists so the behaviour is unit-testable, and the two are
 * covered by the same cases.
 */
export function deriveTitle(message) {
  const firstLine = message.trim().split('\n')[0].trim();
  if (firstLine.length <= TITLE_MAX_LENGTH) return firstLine;
  const clipped = firstLine.slice(0, TITLE_MAX_LENGTH - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

/** Whether the subscriber gate is switched on, as the server reports it. */
export function gateEnabled() {
  return typeof window !== 'undefined' && window.FEEDBACK_GATE_ENABLED === true;
}

/** Where your Substack lives, for the invitation on the email step. */
export const SUBSTACK_URL = 'https://windhoverhistory.substack.com';

const TOKEN_KEY = 'lifelines.feedback.access';

/**
 * The access token, if one is stored and not obviously stale.
 *
 * Expiry is re-checked server-side on every use — this is only to avoid
 * walking someone through a code they do not need, never a security decision.
 * Storage can throw in a private window, so every access is guarded.
 */
export function storedAccessToken() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return '';
    const exp = Number(raw.split('.')[0]);
    if (!exp || exp < Date.now()) { localStorage.removeItem(TOKEN_KEY); return ''; }
    return raw;
  } catch { return ''; }
}

export function storeAccessToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* private window */ }
}

export function clearAccessToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* private window */ }
}

/**
 * Ask for a one-time code.
 *
 * Resolves the same way whether or not the address is subscribed — that is
 * the server's whole design, and the caller must not try to infer otherwise.
 */
export async function requestAccessCode(email, turnstileToken) {
  const res = await fetch('/api/feedback/request-code', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: String(email || '').trim(), token: turnstileToken || '' }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error || ''; } catch { /* non-JSON */ }
    throw new Error(detail || 'Could not send a code. Please try again.');
  }
}

/** Redeem a code. Returns the access token on success. */
export async function redeemAccessCode(email, code) {
  const res = await fetch('/api/feedback/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: String(email || '').trim(), code: String(code || '').trim() }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'That code did not work. Please try again.');
  storeAccessToken(body.token);
  return body.token;
}

/** Whether the page was served with a Turnstile site key configured. */
export function turnstileSiteKey() {
  return (typeof window !== 'undefined' && window.TURNSTILE_SITE_KEY) || '';
}

/**
 * Submit a public note. Resolves on success and throws on failure, so the
 * caller can tell the reader their words did not get through rather than
 * showing a thank-you over a dropped request.
 */
export async function submitPublicFeedback(message, token) {
  const body = (message || '').trim();

  if (!body) throw new Error('Please write something first.');
  if (body.length > FEEDBACK_MAX_LENGTH) {
    throw new Error(`Please keep it under ${FEEDBACK_MAX_LENGTH.toLocaleString()} characters.`);
  }

  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: body, token: token || '', accessToken: storedAccessToken() }),
  });

  if (!res.ok) {
    // A 401 means the stored token has lapsed or been revoked; drop it so the
    // dialog asks for an email again rather than looping on a dead token.
    if (res.status === 401) clearAccessToken();

    // The function returns a short, deliberately uninformative message; use it
    // when present so the reader learns whether to retry or reword.
    let detail = '';
    try { detail = (await res.json())?.error || ''; } catch { /* non-JSON body */ }
    throw new Error(detail || 'Could not send your note. Please try again.');
  }
}
