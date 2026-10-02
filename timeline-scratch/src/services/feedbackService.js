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
    body: JSON.stringify({ message: body, token: token || '' }),
  });

  if (!res.ok) {
    // The function returns a short, deliberately uninformative message; use it
    // when present so the reader learns whether to retry or reword.
    let detail = '';
    try { detail = (await res.json())?.error || ''; } catch { /* non-JSON body */ }
    throw new Error(detail || 'Could not send your note. Please try again.');
  }
}
