/**
 * Server-side Turnstile verification.
 *
 * Written after a production failure where the widget reported "Success!" in
 * the browser and the endpoint answered 403 "Could not verify that you are
 * human." Cloudflare had said exactly why in error-codes, and the code threw
 * it away — so the log was silent and the reader was blamed for a server
 * problem. Both halves are pinned here.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { verifyTurnstile } from '../../functions/_lib/gate.js';

afterEach(() => { vi.restoreAllMocks(); });

const reply = (body, ok = true, status = 200) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok, status, json: async () => body, text: async () => JSON.stringify(body),
  });

describe('verifyTurnstile', () => {
  it('passes a successful challenge', async () => {
    reply({ success: true });
    expect(await verifyTurnstile('tok', 'secret')).toEqual({ ok: true });
  });

  it('surfaces invalid-input-secret rather than a bare false', async () => {
    // The production case: a secret that does not pair with the site key.
    // Without the reason, this is indistinguishable from a genuine bot.
    reply({ success: false, 'error-codes': ['invalid-input-secret'] });
    const v = await verifyTurnstile('tok', 'wrong-secret');
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('invalid-input-secret');
  });

  it('surfaces timeout-or-duplicate, which needs a different fix entirely', async () => {
    reply({ success: false, 'error-codes': ['timeout-or-duplicate'] });
    expect((await verifyTurnstile('spent', 's')).reason).toBe('timeout-or-duplicate');
  });

  it('joins multiple error codes', async () => {
    reply({ success: false, 'error-codes': ['missing-input-secret', 'invalid-input-response'] });
    expect((await verifyTurnstile('', '')).reason)
      .toBe('missing-input-secret,invalid-input-response');
  });

  it('still reports a reason when Cloudflare sends none', async () => {
    reply({ success: false });
    expect((await verifyTurnstile('tok', 's')).reason).toBe('verify-failed');
  });

  it('treats a non-200 from the verifier as a failed challenge, not a pass', async () => {
    reply({}, false, 500);
    const v = await verifyTurnstile('tok', 's');
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('verify-http-500');
  });

  it('treats an unreachable verifier as a failed challenge, not a pass', async () => {
    // Fail closed. A network blip must never wave a submission through.
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    const v = await verifyTurnstile('tok', 's');
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/verify-unreachable/);
  });

  it('sends the secret and token as form fields, and remoteip only when given', async () => {
    const f = reply({ success: true });
    await verifyTurnstile('tok', 'sec', '203.0.113.9');
    const body = f.mock.calls[0][1].body;
    expect(body.get('secret')).toBe('sec');
    expect(body.get('response')).toBe('tok');
    expect(body.get('remoteip')).toBe('203.0.113.9');

    f.mockClear();
    await verifyTurnstile('tok', 'sec');
    expect(f.mock.calls[0][1].body.get('remoteip')).toBeNull();
  });
});
