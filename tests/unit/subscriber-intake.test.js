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
import { describe, it, expect } from 'vitest';
import {
  extractSubscriberAddress, decodeQuotedPrintable, hashEmail,
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
