/**
 * Subscriber intake.
 *
 * The fixture mirrors a real Substack "New free subscriber" notification: the
 * same From, the same "Email:" label, and — importantly — the same decoys. The
 * raw message contains Substack's own no-reply address, the publisher's address
 * in To, and unsubscribe links. Anything that grabs the first email-shaped
 * string in the message enrols the wrong person, so that is what these cases
 * are built to catch.
 *
 * No real address appears here.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import intake, {
  extractSubscriberAddress, decodeQuotedPrintable, hashEmail, missingBindings,
} from '../../workers/subscriber-intake/src/index.js';
import { hashEmail as gateHashEmail } from '../../functions/_lib/gate.js';

const SUBSCRIBER = 'new.reader@example.com';
const PUBLISHER = 'publisher@example.org';

/** Headers behave like the Headers object a Worker is handed. */
const headers = (map) => ({ get: (k) => map[k.toLowerCase()] ?? null });

const NOTIFICATION = `Return-Path: <no-reply@substack.com>
From: Substack <no-reply@substack.com>
Reply-To: ${SUBSCRIBER}
To: ${PUBLISHER}
Subject: New free subscriber to Let's get post-apocalyptic!
Content-Type: text/html; charset="utf-8"
Content-Transfer-Encoding: quoted-printable

<h1>New free subscriber to Let's get post-apocalyptic!</h1>
<p><strong>Email:</strong> <a href=3D"mailto:${SUBSCRIBER}">${SUBSCRIBER}</a></p>
<p><strong>Source:</strong> Substack App</p>
<p>Also subscribes to permeability and 8 other Substacks</p>
<p>To unsubscribe from these notifications, click
<a href=3D"https://substack.com/unsub?e=3Dno-reply@substack.com">here</a></p>
`;

const ENV = { PUBLISHER_EMAIL: PUBLISHER };

describe('picking the subscriber out of the notification', () => {
  it('finds the address behind the "Email:" label', () => {
    const got = extractSubscriberAddress(NOTIFICATION, headers({ 'reply-to': SUBSCRIBER }), ENV);
    expect(got).toBe(SUBSCRIBER);
  });

  it("never enrols Substack's own no-reply address", () => {
    // It appears in From, Return-Path and the unsubscribe link.
    const got = extractSubscriberAddress(NOTIFICATION, headers({ 'reply-to': SUBSCRIBER }), ENV);
    expect(got).not.toContain('substack.com');
  });

  it('never enrols the publisher, who appears as the recipient', () => {
    // Body label stripped, so the publisher is the only plausible candidate.
    const withoutLabel = NOTIFICATION.replace(/Email:/, 'Addressed:');
    const got = extractSubscriberAddress(withoutLabel, headers({ 'reply-to': PUBLISHER }), ENV);
    expect(got).toBeNull();
  });

  it('falls back to Reply-To when the body layout changes', () => {
    // A restyle that drops the label must not stop enrolment outright.
    const restyled = NOTIFICATION.replace(/<p><strong>Email:.*\n/, '');
    const got = extractSubscriberAddress(restyled, headers({ 'reply-to': SUBSCRIBER }), ENV);
    expect(got).toBe(SUBSCRIBER);
  });

  it('returns nothing when neither signal is present, rather than guessing', () => {
    const stripped = NOTIFICATION.replace(/Email:/, 'Addressed:');
    const got = extractSubscriberAddress(stripped, headers({}), ENV);
    expect(got).toBeNull();
  });

  it('survives a quoted-printable soft break splitting the address', () => {
    // The classic HTML-mail failure: "=" plus newline mid-address.
    const split = `Email: new.rea=\r\nder@example.com`;
    expect(extractSubscriberAddress(split, headers({}), ENV)).toBe(SUBSCRIBER);
  });
});

describe('quoted-printable decoding', () => {
  it('removes soft line breaks and decodes hex escapes', () => {
    expect(decodeQuotedPrintable('a=\r\nb')).toBe('ab');
    expect(decodeQuotedPrintable('href=3D"x"')).toBe('href="x"');
  });
});

describe('the digest matches the gate', () => {
  it('hashes identically to functions/_lib/gate.js', async () => {
    // Two implementations of one scheme again. If they drift, the Worker
    // enrols digests the gate will never match, and the symptom is that new
    // subscribers are silently refused.
    const secret = 'shared-secret';
    expect(await hashEmail(secret, SUBSCRIBER)).toBe(await gateHashEmail(secret, SUBSCRIBER));
  });

  it('normalises case and whitespace the same way', async () => {
    const secret = 'shared-secret';
    expect(await hashEmail(secret, '  New.Reader@EXAMPLE.com '))
      .toBe(await gateHashEmail(secret, SUBSCRIBER));
  });
});

/**
 * The Worker's configuration, which is nobody's idea of interesting until it
 * is wrong.
 *
 * A Worker shares no variables with the Pages project, so SUPABASE_URL being
 * absent here is an ordinary mistake rather than an exotic one — and the shape
 * of the failure is the problem: enrol() would POST to "undefined/rest/v1/...",
 * the throw would be caught by the handler's own catch, the notification would
 * forward as normal, and enrolment would be dead with nothing but a generic
 * fetch error to say so. These cases pin the guard that makes it loud.
 */
const AUTHENTIC_HEADERS = {
  from: 'Substack <no-reply@substack.com>',
  'reply-to': SUBSCRIBER,
  subject: "New free subscriber to Let's get post-apocalyptic!",
  'authentication-results': 'mx.cloudflare.net; dkim=pass header.d=mg1.substack.com; spf=pass',
};

const GOOD_ENV = {
  ...ENV,
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  FEEDBACK_SIGNING_SECRET: 'shared-secret',
  FORWARD_TO: 'admin@example.org',
};

function fakeMessage(rawText, hdrs) {
  const forwarded = [];
  return {
    forwarded,
    from: 'no-reply@substack.com',
    headers: headers(hdrs),
    raw: new ReadableStream({
      start(c) { c.enqueue(new TextEncoder().encode(rawText)); c.close(); },
    }),
    forward: async (to) => { forwarded.push(to); },
  };
}

afterEach(() => { vi.restoreAllMocks(); });

describe('the configuration guard', () => {
  it('names every missing binding, and nothing that is present', () => {
    expect(missingBindings(GOOD_ENV)).toEqual([]);
    expect(missingBindings({ ...GOOD_ENV, SUPABASE_URL: undefined }))
      .toEqual(['SUPABASE_URL']);
    expect(missingBindings({})).toEqual([
      'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'FEEDBACK_SIGNING_SECRET',
    ]);
  });

  it('does not attempt to enrol when SUPABASE_URL is unset', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const errors = [];
    vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a.join(' ')));

    const message = fakeMessage(NOTIFICATION, AUTHENTIC_HEADERS);
    await intake.email(message, { ...GOOD_ENV, SUPABASE_URL: undefined }, {});

    // The whole point: no request is made to a URL built from `undefined`.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errors.join('\n')).toMatch(/MISCONFIGURED.*SUPABASE_URL/s);
  });

  it('still forwards the notification when misconfigured', async () => {
    // A configuration mistake must not also eat the publisher's mail.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const message = fakeMessage(NOTIFICATION, AUTHENTIC_HEADERS);
    await intake.email(message, { ...GOOD_ENV, SUPABASE_URL: undefined }, {});
    expect(message.forwarded).toEqual(['admin@example.org']);
  });

  it('forwards exactly once, not twice, when misconfigured', async () => {
    // The early return skips the trailing forward; if that ever stops being
    // true the publisher gets every notification in duplicate.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const message = fakeMessage(NOTIFICATION, AUTHENTIC_HEADERS);
    await intake.email(message, { ...GOOD_ENV, SUPABASE_URL: undefined }, {});
    expect(message.forwarded).toHaveLength(1);
  });

  it('enrols as normal once every binding is present', async () => {
    // The guard must gate the broken case only. Without this, a guard that
    // rejected everything would look identical to a working one.
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, status: 201, text: async () => '' });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const message = fakeMessage(NOTIFICATION, AUTHENTIC_HEADERS);
    await intake.email(message, GOOD_ENV, {});

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://example.supabase.co/rest/v1/Feedback_Subscribers');
    // The address itself must never be what gets stored.
    const body = JSON.parse(init.body);
    expect(body.email_hmac).toBe(await hashEmail('shared-secret', SUBSCRIBER));
    expect(JSON.stringify(body)).not.toContain(SUBSCRIBER);
    expect(message.forwarded).toEqual(['admin@example.org']);
  });
});
