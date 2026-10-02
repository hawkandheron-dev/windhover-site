/**
 * Subscriber intake — enrols new Substack subscribers the moment they arrive.
 *
 * Substack has no API, so the subscriber roll would otherwise be a snapshot
 * that goes stale the instant it is taken: someone who follows the "subscribe"
 * link from the feedback dialog, subscribes, and comes straight back would be
 * refused. Converted, then shut out.
 *
 * Substack does send the publisher a "New free subscriber" notification, and
 * that notification carries the subscriber's address. Cloudflare Email Routing
 * can hand a message to a Worker, so this one reads the notification, adds the
 * address to the roll as an HMAC digest, and forwards the message on so it
 * still lands in the inbox. A tap on the line, not a diversion.
 *
 * TWO THINGS CARRY THE WEIGHT HERE.
 *
 * Authenticity. Without it this Worker is a public write endpoint: anyone who
 * learned the routing address could mail it and enrol themselves, which is
 * precisely the thing the gate exists to prevent. So a message must look like
 * it came from Substack AND carry a passing DKIM signature for substack.com.
 *
 * Visibility of failure. If Substack restyles the notification, a quiet parser
 * simply stops matching and enrolment stops with it — the only symptom being a
 * subscriber complaining weeks later that they are locked out. So anything
 * that cannot be parsed is logged loudly and forwarded regardless.
 */

const SUBSTACK_DOMAIN = 'substack.com';

/** Both kinds count: a paid subscriber is a subscriber. */
const SUBJECT_PATTERN = /New\s+(free|paid|gift)\s+subscriber/i;

/**
 * The address sits after an "Email:" label in the body. Tolerates the HTML
 * version, where the label and the value are separated by tags.
 */
const BODY_EMAIL_PATTERN = /Email:\s*(?:<[^>]*>\s*)*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i;

export default {
  async email(message, env, ctx) {
    const forward = async () => {
      if (env.FORWARD_TO) {
        try { await message.forward(env.FORWARD_TO); }
        catch (err) { console.error('intake: forward failed', err?.message); }
      }
    };

    // A Worker is a separate project from Pages and inherits none of its
    // variables, so a missing binding here is a live possibility, not a
    // theoretical one. Checked first and named in the log, because otherwise
    // enrol() POSTs to "undefined/rest/v1/..." and the only symptom is a
    // generic fetch error swallowed by the catch below.
    const missing = missingBindings(env);
    if (missing.length) {
      console.error(`intake: MISCONFIGURED — missing ${missing.join(', ')}. ` +
                    'Enrolment cannot run until these are set on the Worker.');
      await forward();
      return;
    }

    try {
      const raw = await readRaw(message);
      const headers = message.headers;
      const from = (headers.get('from') || '').toLowerCase();
      const subject = headers.get('subject') || '';
      const authResults = headers.get('authentication-results') || '';

      // Logged on every message: the first real forwarded notification is the
      // only way to learn what the authentication headers actually look like
      // once an intermediate mailbox has relayed it.
      console.log('intake: received', JSON.stringify({
        from,
        subject: subject.slice(0, 80),
        authResults: authResults.slice(0, 200),
        envelopeFrom: message.from,
      }));

      if (!isAuthentic(from, authResults, env)) {
        console.warn('intake: rejected, not an authenticated Substack message');
        await forward();
        return;
      }

      if (!SUBJECT_PATTERN.test(subject)) {
        // Substack sends plenty of other mail. Not an error.
        await forward();
        return;
      }

      const address = extractSubscriberAddress(raw, headers, env);
      if (!address) {
        console.error('intake: COULD NOT PARSE an address from a subscriber ' +
                      'notification. The format has probably changed — ' +
                      'enrolment is silently stopped until this is fixed.');
        await forward();
        return;
      }

      await enrol(address, env);
    } catch (err) {
      console.error('intake: unhandled failure', err?.message);
    }

    // The notification reaches the inbox whatever happened above.
    await forward();
  },
};

/**
 * Looks genuinely like Substack.
 *
 * The From header alone is trivially forged, so a DKIM pass for substack.com
 * is required too. Forwarding through another mailbox usually preserves the
 * original DKIM signature — it signs the headers and body, which a plain
 * forward leaves intact — but if it turns out not to survive in practice, the
 * log line above will show it, and ALLOW_UNSIGNED exists as a deliberate,
 * visible escape hatch rather than a silent weakening.
 */
function isAuthentic(from, authResults, env) {
  const claimsSubstack = from.includes(`@${SUBSTACK_DOMAIN}`);
  if (!claimsSubstack) return false;

  if (env.ALLOW_UNSIGNED === 'true') {
    console.warn('intake: ALLOW_UNSIGNED is on — DKIM is not being enforced');
    return true;
  }

  // e.g. "dkim=pass header.d=substack.com"
  const dkimOk = /dkim=pass[^;]*header\.d=(?:[\w-]+\.)?substack\.com/i.test(authResults);
  return dkimOk;
}

/**
 * The subscriber's address, distinguished from every other address in the
 * message — Substack's own no-reply, the publisher's, unsubscribe links.
 *
 * Preferred source is the "Email:" label in the body. Reply-To carries the
 * same address and is used to corroborate it, or to stand in if the body
 * cannot be read: two independent signals, so a restyle of one does not
 * necessarily break enrolment.
 */
export function extractSubscriberAddress(raw, headers, env = {}) {
  const decoded = decodeQuotedPrintable(raw);

  const candidates = [];
  const body = BODY_EMAIL_PATTERN.exec(decoded);
  if (body) candidates.push(body[1]);

  const replyTo = parseAddress(headers.get?.('reply-to') || '');
  if (replyTo) candidates.push(replyTo);

  const publisher = String(env.PUBLISHER_EMAIL || '').toLowerCase();

  for (const candidate of candidates) {
    const address = candidate.toLowerCase();
    // Substack's own addresses are all over the message.
    if (address.endsWith(`@${SUBSTACK_DOMAIN}`)) continue;
    // The publisher appears as the recipient, and must never self-enrol.
    if (publisher && address === publisher) continue;
    return address;
  }
  return null;
}

/** "Jessie <someone@example.com>" or a bare address. */
function parseAddress(value) {
  const m = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/.exec(value || '');
  return m ? m[1] : null;
}

/**
 * HTML mail is usually quoted-printable, which inserts "=" soft line breaks
 * mid-word — enough to split an address in half and defeat the match.
 */
export function decodeQuotedPrintable(text) {
  return String(text || '')
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

async function readRaw(message) {
  // Cap the read: a notification is small, and an enormous message should not
  // be able to exhaust the Worker.
  const MAX = 512 * 1024;
  const reader = message.raw.getReader();
  const chunks = [];
  let total = 0;
  while (total < MAX) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  try { await reader.cancel(); } catch { /* already closed */ }
  return new TextDecoder().decode(concat(chunks, total));
}

function concat(chunks, total) {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    const room = Math.min(c.length, total - offset);
    out.set(c.subarray(0, room), offset);
    offset += room;
  }
  return out;
}

/** Hash with the same pepper and label the gate uses, then insert. */
async function enrol(address, env) {
  const digest = await hashEmail(env.FEEDBACK_SIGNING_SECRET, address);

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/Feedback_Subscribers`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify({ email_hmac: digest }),
  });

  if (!res.ok) {
    console.error('intake: enrol failed', res.status, await res.text());
    return;
  }
  // The digest, never the address — this log is not a place to leak a reader.
  console.log('intake: enrolled', digest.slice(0, 12));
}

/**
 * The bindings enrolment cannot run without, by name.
 *
 * Names only: the values are a service-role key and a signing pepper, and
 * neither belongs anywhere near a log line. Exported so the guard can be
 * tested without standing up a message.
 */
export function missingBindings(env) {
  return ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'FEEDBACK_SIGNING_SECRET']
    .filter((name) => !env?.[name]);
}

/** Identical to hashEmail in functions/_lib/gate.js; the digests must match. */
export async function hashEmail(secret, email) {
  const normalized = String(email || '').trim().toLowerCase();
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(`email-v1:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(normalized));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
