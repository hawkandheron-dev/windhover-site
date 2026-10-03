/**
 * The subscriber gate.
 *
 * The property this design exists to provide is that request-code reveals
 * nothing about who subscribes. It is asserted here as a literal equality of
 * status and body, not inferred from a status code, because an inequality that
 * crept in later would be invisible to any weaker check.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequest as requestCode } from '../../functions/api/feedback/request-code.js';
import { onRequest as verifyCode } from '../../functions/api/feedback/verify.js';
import { onRequest as submitFeedback } from '../../functions/api/feedback.js';
import { hashEmail, hashCode, issueToken, verifyToken, normalizeEmail, generateCode, timingSafeEqual }
  from '../../functions/_lib/gate.js';

const SECRET = 'test-signing-secret';
const ENV = {
  TURNSTILE_SECRET_KEY: 'turnstile-secret',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  SUPABASE_URL: 'https://db.invalid',
  RESEND_API_KEY: 'resend-key',
  FEEDBACK_SIGNING_SECRET: SECRET,
};

const post = (url, body) => new Request(url, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

/**
 * Fakes Turnstile, Resend and PostgREST. `subscribers` is the roll; `codes`
 * is mutable so consumption and attempt counting can be observed.
 */
function mockWorld({ subscribers = [], codes = [], turnstileOk = true, resendOk = true } = {}) {
  const calls = [];
  global.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, init });

    if (u.includes('siteverify')) {
      return new Response(JSON.stringify({ success: turnstileOk }), { status: 200 });
    }
    if (u.includes('api.resend.com')) {
      return new Response(resendOk ? '{}' : 'nope', { status: resendOk ? 200 : 422 });
    }
    if (u.includes('Feedback_Subscribers')) {
      const want = /email_hmac=eq\.([a-f0-9]+)/.exec(u)?.[1];
      return new Response(JSON.stringify(subscribers.includes(want) ? [{ email_hmac: want }] : []), { status: 200 });
    }
    if (u.includes('Feedback_Access_Codes')) {
      if (init.method === 'POST') { codes.push(JSON.parse(init.body)); return new Response('', { status: 201 }); }
      if (init.method === 'PATCH') {
        const target = /code_hmac=eq\.([a-f0-9]+)/.exec(u)?.[1];
        const row = codes.find(c => c.code_hmac === target);
        if (!row) return new Response('[]', { status: 200 });
        Object.assign(row, JSON.parse(init.body));
        return new Response(JSON.stringify([row]), { status: 200 });
      }
      const byCode = /code_hmac=eq\.([a-f0-9]+)/.exec(u)?.[1];
      const byEmail = /email_hmac=eq\.([a-f0-9]+)/.exec(u)?.[1];
      let rows = codes;
      if (byCode) rows = rows.filter(c => c.code_hmac === byCode);
      if (byEmail) rows = rows.filter(c => c.email_hmac === byEmail);
      if (u.includes('consumed_at=is.null')) rows = rows.filter(c => !c.consumed_at);
      return new Response(JSON.stringify(rows), { status: 200 });
    }
    if (u.includes('App_Issues')) return new Response('', { status: 201 });
    return new Response('{}', { status: 200 });
  });
  return { calls, codes };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const URL_REQ = 'https://site.invalid/api/feedback/request-code';
const URL_VER = 'https://site.invalid/api/feedback/verify';
const URL_SUB = 'https://site.invalid/api/feedback';

describe('request-code reveals nothing about who subscribes', () => {
  it('answers a subscriber and a stranger identically, byte for byte', async () => {
    const known = await hashEmail(SECRET, 'member@example.com');

    mockWorld({ subscribers: [known] });
    const a = await requestCode({ request: post(URL_REQ, { email: 'member@example.com', token: 't' }), env: ENV });
    const aBody = await a.text();

    mockWorld({ subscribers: [known] });
    const b = await requestCode({ request: post(URL_REQ, { email: 'stranger@example.com', token: 't' }), env: ENV });
    const bBody = await b.text();

    expect(a.status).toBe(b.status);
    expect(aBody).toBe(bBody);
  });

  it('still answers identically when sending the email fails', async () => {
    // "We could not email you" would confirm there was an address to email.
    const known = await hashEmail(SECRET, 'member@example.com');

    mockWorld({ subscribers: [known], resendOk: false });
    const a = await requestCode({ request: post(URL_REQ, { email: 'member@example.com', token: 't' }), env: ENV });

    mockWorld({ subscribers: [] });
    const b = await requestCode({ request: post(URL_REQ, { email: 'nobody@example.com', token: 't' }), env: ENV });

    expect(a.status).toBe(b.status);
    expect(await a.text()).toBe(await b.text());
  });

  it('emails only the subscriber, and never a stranger', async () => {
    const known = await hashEmail(SECRET, 'member@example.com');

    const w1 = mockWorld({ subscribers: [known] });
    await requestCode({ request: post(URL_REQ, { email: 'member@example.com', token: 't' }), env: ENV });
    expect(w1.calls.some(c => c.url.includes('resend'))).toBe(true);

    const w2 = mockWorld({ subscribers: [known] });
    await requestCode({ request: post(URL_REQ, { email: 'stranger@example.com', token: 't' }), env: ENV });
    expect(w2.calls.some(c => c.url.includes('resend'))).toBe(false);
  });

  it('refuses without a valid Turnstile token, before touching the roll', async () => {
    const w = mockWorld({ turnstileOk: false });
    const res = await requestCode({ request: post(URL_REQ, { email: 'a@b.com', token: 'bad' }), env: ENV });
    expect(res.status).toBe(403);
    expect(w.calls.some(c => c.url.includes('Feedback_Subscribers'))).toBe(false);
  });
});

describe('redeeming a code', () => {
  async function withIssuedCode() {
    const email = 'member@example.com';
    const emailHash = await hashEmail(SECRET, email);
    const code = '123456';
    const codes = [{
      code_hmac: await hashCode(SECRET, code),
      email_hmac: emailHash,
      expires_at: new Date(Date.now() + 600_000).toISOString(),
      consumed_at: null,
      attempts: 0,
    }];
    return { email, code, codes, emailHash };
  }

  it('issues a token for a good code', async () => {
    const { email, code, codes } = await withIssuedCode();
    mockWorld({ codes });
    const res = await verifyCode({ request: post(URL_VER, { email, code }), env: ENV });

    expect(res.status).toBe(200);
    const { token } = await res.json();
    expect(await verifyToken(SECRET, token)).toBeTruthy();
  });

  it('refuses the same code twice', async () => {
    const { email, code, codes } = await withIssuedCode();
    mockWorld({ codes });
    expect((await verifyCode({ request: post(URL_VER, { email, code }), env: ENV })).status).toBe(200);
    const second = await verifyCode({ request: post(URL_VER, { email, code }), env: ENV });
    expect(second.status).toBe(400);
  });

  it('refuses an expired code', async () => {
    const { email, code, codes } = await withIssuedCode();
    codes[0].expires_at = new Date(Date.now() - 1000).toISOString();
    mockWorld({ codes });
    expect((await verifyCode({ request: post(URL_VER, { email, code }), env: ENV })).status).toBe(400);
  });

  it("refuses another subscriber's code", async () => {
    const { code, codes } = await withIssuedCode();
    mockWorld({ codes });
    // Right code, wrong address: the row is matched on both hashes.
    const res = await verifyCode({ request: post(URL_VER, { email: 'someone@else.com', code }), env: ENV });
    expect(res.status).toBe(400);
  });

  it('counts wrong guesses against the live code and cuts them off', async () => {
    const { email, codes } = await withIssuedCode();
    mockWorld({ codes });
    for (let i = 0; i < 5; i++) {
      await verifyCode({ request: post(URL_VER, { email, code: '000000' }), env: ENV });
    }
    expect(codes[0].attempts).toBeGreaterThanOrEqual(5);

    // The real code is now dead too — the cap is on the code, not the guess.
    const res = await verifyCode({ request: post(URL_VER, { email, code: '123456' }), env: ENV });
    expect(res.status).toBe(429);
  });
});

describe('the access token on /api/feedback', () => {
  it('refuses a submission with no token when the gate is on', async () => {
    const w = mockWorld();
    const res = await submitFeedback({ request: post(URL_SUB, { message: 'hi', token: 't' }), env: ENV });
    expect(res.status).toBe(401);
    expect(w.calls.some(c => c.url.includes('App_Issues'))).toBe(false);
  });

  it('refuses a tampered token', async () => {
    const good = await issueToken(SECRET, await hashEmail(SECRET, 'member@example.com'));
    const tampered = good.replace(/^\d+/, String(Date.now() + 9_000_000_000));
    const w = mockWorld();
    const res = await submitFeedback({
      request: post(URL_SUB, { message: 'hi', token: 't', accessToken: tampered }), env: ENV });
    expect(res.status).toBe(401);
    expect(w.calls.some(c => c.url.includes('App_Issues'))).toBe(false);
  });

  it('refuses a token signed with a different secret', async () => {
    const foreign = await issueToken('some-other-secret', await hashEmail(SECRET, 'member@example.com'));
    mockWorld();
    const res = await submitFeedback({
      request: post(URL_SUB, { message: 'hi', token: 't', accessToken: foreign }), env: ENV });
    expect(res.status).toBe(401);
  });

  it('accepts a good token and records which subscriber, as a hash', async () => {
    const emailHash = await hashEmail(SECRET, 'member@example.com');
    const token = await issueToken(SECRET, emailHash);
    const w = mockWorld();
    const res = await submitFeedback({
      request: post(URL_SUB, { message: 'A note', token: 't', accessToken: token }), env: ENV });

    expect(res.status).toBe(201);
    const insert = w.calls.find(c => c.url.includes('App_Issues'));
    const body = JSON.parse(insert.init.body);
    expect(body.page_context.subscriber_ref).toBe(emailHash.slice(0, 16));
    // The address itself must appear nowhere in the row.
    expect(JSON.stringify(body)).not.toContain('member@example.com');
  });

  it('keeps working with no token when the gate is switched off', async () => {
    // Policy control, not the security boundary: without its secrets the gate
    // is off and Turnstile alone applies, as before the gate existed.
    const { RESEND_API_KEY, FEEDBACK_SIGNING_SECRET, ...ungated } = ENV;
    const w = mockWorld();
    const res = await submitFeedback({ request: post(URL_SUB, { message: 'hi', token: 't' }), env: ungated });
    expect(res.status).toBe(201);
    expect(w.calls.some(c => c.url.includes('App_Issues'))).toBe(true);
  });
});

describe('crypto helpers', () => {
  it('normalises addresses the same way at import and at lookup', async () => {
    expect(normalizeEmail('  Member@Example.COM ')).toBe('member@example.com');
    expect(await hashEmail(SECRET, ' MEMBER@example.com'))
      .toBe(await hashEmail(SECRET, 'member@example.com'));
  });

  it('produces a different digest under a different pepper', async () => {
    expect(await hashEmail(SECRET, 'a@b.com')).not.toBe(await hashEmail('other', 'a@b.com'));
  });

  it('keeps the email and code digests independent despite one secret', async () => {
    // Shared key, separated by context label.
    expect(await hashEmail(SECRET, 'x')).not.toBe(await hashCode(SECRET, 'x'));
  });

  it('generates six-digit codes', () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });

  it('rejects an expired token', async () => {
    const expired = await issueToken(SECRET, 'abc', -1);
    expect(await verifyToken(SECRET, expired)).toBeNull();
  });

  it('compares in constant time without short-circuiting on length', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });
});

/**
 * A misconfigured server must say so, not blame the reader.
 *
 * From a real production failure: Turnstile said "Success!" in the browser,
 * the endpoint answered 403 "Could not verify that you are human", and the
 * log said nothing. gateEnabled keys only on RESEND_API_KEY and
 * FEEDBACK_SIGNING_SECRET, so an absent TURNSTILE_SECRET_KEY sailed past it
 * and reached the verifier, which naturally refused. /api/feedback already
 * failed closed with 503 in that case; request-code did not, and the two
 * endpoints disagreeing is what made it hard to read.
 */
describe('request-code fails closed on missing configuration', () => {
  for (const missing of ['TURNSTILE_SECRET_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    it(`answers 503, not 403, when ${missing} is unset`, async () => {
      mockWorld({ subscribers: [] });
      const env = { ...ENV, [missing]: undefined };
      const res = await requestCode({ request: post(URL_REQ, { email: 'a@b.com', token: 't' }), env });

      expect(res.status).toBe(503);
      // 403 would tell a person they failed a human check for a variable
      // nobody set — the single most misleading answer available.
      expect(res.status).not.toBe(403);
      expect((await res.json()).error).toMatch(/not configured/i);
    });
  }

  it('names the absent binding in the log, by name only', async () => {
    mockWorld({ subscribers: [] });
    const logged = [];
    console.error.mockImplementation((...a) => logged.push(JSON.stringify(a)));

    await requestCode({
      request: post(URL_REQ, { email: 'a@b.com', token: 't' }),
      env: { ...ENV, TURNSTILE_SECRET_KEY: undefined },
    });

    const line = logged.join('\n');
    expect(line).toMatch(/missing env/);
    expect(line).toMatch(/"turnstile":false/);
    // Never the values themselves.
    expect(line).not.toContain('service-role');
    expect(line).not.toContain(SECRET);
  });

  it('logs why Turnstile refused, so a failure is diagnosable', async () => {
    // The secret is present but wrong: Cloudflare says invalid-input-secret.
    global.fetch = vi.fn(async (url) => String(url).includes('siteverify')
      ? new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-secret'] }), { status: 200 })
      : new Response('{}', { status: 200 }));
    const warned = [];
    console.warn.mockImplementation((...a) => warned.push(a.join(' ')));

    const res = await requestCode({ request: post(URL_REQ, { email: 'a@b.com', token: 't' }), env: ENV });

    expect(res.status).toBe(403);
    expect(warned.join('\n')).toMatch(/invalid-input-secret/);
  });
});
