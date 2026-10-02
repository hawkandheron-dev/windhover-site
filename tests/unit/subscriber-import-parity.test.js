/**
 * The import script and the gate must hash identically.
 *
 * They are two implementations of one scheme: the script uses Node's crypto on
 * a laptop, the gate uses Web Crypto in a Worker. If they ever disagree — a
 * changed context label, a different normalisation, one of them trimming and
 * the other not — nothing throws. Every address simply hashes to something the
 * gate will never match, and the symptom is "no subscriber ever receives a
 * code", which is a miserable thing to debug from the outside.
 *
 * So the agreement is pinned here rather than trusted.
 */
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { hashEmail, normalizeEmail } from '../../functions/_lib/gate.js';

const SECRET = 'shared-secret';

/** Exactly what scripts/import-subscribers.mjs does. */
const importSideHash = (email) =>
  createHmac('sha256', `email-v1:${SECRET}`)
    .update(String(email || '').trim().toLowerCase())
    .digest('hex');

describe('import script and gate agree', () => {
  it('produces the same digest for the same address', async () => {
    for (const email of ['member@example.com', 'a.b+tag@sub.domain.co.uk', 'UPPER@EXAMPLE.COM']) {
      expect(await hashEmail(SECRET, email), email).toBe(importSideHash(email));
    }
  });

  it('agrees on normalisation, not just on the hash', async () => {
    // Whitespace and case are the two things a CSV reliably varies.
    expect(await hashEmail(SECRET, '  Member@Example.com  ')).toBe(importSideHash('member@example.com'));
    expect(normalizeEmail('  Member@Example.com  ')).toBe('member@example.com');
  });

  it('diverges when the secret differs, so a mismatched pepper is not silently tolerated', async () => {
    expect(await hashEmail('other-secret', 'member@example.com')).not.toBe(importSideHash('member@example.com'));
  });
});
