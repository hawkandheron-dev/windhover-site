/**
 * The public feedback endpoint.
 *
 * This function is the only way a note reaches the database now — the
 * anonymous insert policy is gone — so the gate it implements is the whole
 * protection. The case that matters most is the one asserted hardest: an
 * unverified token must not produce an insert at all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequest } from '../../functions/api/feedback.js';

const ENV = {
  TURNSTILE_SECRET_KEY: 'secret',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  SUPABASE_URL: 'https://db.invalid',
};

const post = (body, headers = {}) => new Request('https://site.invalid/api/feedback', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

/** Scripts both hops: Turnstile verify, then the Supabase insert. */
function mockFetch({ verifyOk = true, verifyStatus = 200, insertStatus = 201 } = {}) {
  const calls = [];
  global.fetch = vi.fn(async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('siteverify')) {
      return new Response(JSON.stringify({ success: verifyOk, 'error-codes': verifyOk ? [] : ['invalid-input-response'] }),
        { status: verifyStatus, headers: { 'content-type': 'application/json' } });
    }
    return new Response('', { status: insertStatus });
  });
  return calls;
}

const insertCalls = (calls) => calls.filter(c => c.url.includes('App_Issues'));

beforeEach(() => { vi.restoreAllMocks(); vi.spyOn(console, 'warn').mockImplementation(() => {});
                   vi.spyOn(console, 'error').mockImplementation(() => {}); });

describe('method handling', () => {
  it('refuses anything but POST', async () => {
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const res = await onRequest({ request: new Request('https://site.invalid/api/feedback', { method }), env: ENV });
      expect(res.status, method).toBe(405);
      expect(res.headers.get('allow')).toBe('POST');
    }
  });
});

describe('the captcha gate', () => {
  it('does not insert when the token fails verification', async () => {
    const calls = mockFetch({ verifyOk: false });
    const res = await onRequest({ request: post({ message: 'spam', token: 'forged' }), env: ENV });

    expect(res.status).toBe(403);
    // The point of the whole exercise.
    expect(insertCalls(calls)).toHaveLength(0);
  });

  it('does not insert when no token is supplied', async () => {
    const calls = mockFetch();
    const res = await onRequest({ request: post({ message: 'hello' }), env: ENV });

    expect(res.status).toBe(400);
    // Not even the verification hop: nothing to verify.
    expect(calls).toHaveLength(0);
  });

  it('does not insert when Cloudflare itself errors', async () => {
    // A failing verifier must fail closed, not wave the note through.
    const calls = mockFetch({ verifyStatus: 500 });
    const res = await onRequest({ request: post({ message: 'hello', token: 'tok' }), env: ENV });

    expect(res.status).toBe(403);
    expect(insertCalls(calls)).toHaveLength(0);
  });

  it('passes the visitor IP to the verifier when the edge supplies one', async () => {
    const calls = mockFetch();
    await onRequest({ request: post({ message: 'hi', token: 'tok' }, { 'CF-Connecting-IP': '203.0.113.9' }), env: ENV });

    const verify = calls.find(c => c.url.includes('siteverify'));
    expect(String(verify.init.body)).toContain('remoteip=203.0.113.9');
  });
});

describe('a verified note', () => {
  it('inserts with every policy-pinned column set, and reports success', async () => {
    const calls = mockFetch();
    const res = await onRequest({
      request: post({ message: 'Alcuin’s dates look wrong.\nOtherwise lovely.', token: 'tok' }),
      env: ENV,
    });

    expect(res.status).toBe(201);

    const insert = insertCalls(calls)[0];
    expect(insert).toBeTruthy();
    const body = JSON.parse(insert.init.body);
    expect(body).toMatchObject({
      app_id: 'ch-timeline-2',
      issue_type: 'general',
      status: 'submitted',
      source: 'public',
      submitted_by: null,
    });
    // Title derived from the first line, body kept whole.
    expect(body.title).toBe('Alcuin’s dates look wrong.');
    expect(body.description).toContain('Otherwise lovely.');

    // The service-role key authenticates the insert and never the verify hop.
    expect(insert.init.headers.authorization).toBe('Bearer service-role');
    const verify = calls.find(c => c.url.includes('siteverify'));
    expect(String(verify.init.body)).not.toContain('service-role');
  });
});

describe('input bounds', () => {
  it('rejects an empty message before verifying anything', async () => {
    const calls = mockFetch();
    expect((await onRequest({ request: post({ message: '   ', token: 'tok' }), env: ENV })).status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('rejects an oversized message', async () => {
    const calls = mockFetch();
    const res = await onRequest({ request: post({ message: 'z'.repeat(4001), token: 'tok' }), env: ENV });
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('rejects a body that is not JSON', async () => {
    mockFetch();
    expect((await onRequest({ request: post('not json'), env: ENV })).status).toBe(400);
  });
});

describe('configuration and failure', () => {
  it('fails closed when a secret is missing, rather than skipping the captcha', async () => {
    const calls = mockFetch();
    for (const missing of ['TURNSTILE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL']) {
      const env = { ...ENV, [missing]: undefined };
      const res = await onRequest({ request: post({ message: 'hi', token: 'tok' }), env });
      expect(res.status, missing).toBe(503);
    }
    expect(insertCalls(calls)).toHaveLength(0);
  });

  it('does not leak database detail when the insert fails', async () => {
    mockFetch({ insertStatus: 409 });
    const res = await onRequest({ request: post({ message: 'hi', token: 'tok' }), env: ENV });

    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).not.toMatch(/App_Issues|duplicate|constraint|column/i);
  });
});
