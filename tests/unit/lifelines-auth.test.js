import { describe, it, expect } from 'vitest';
import { lifelinesClerkKey, hasClerkSession } from '../../timeline-scratch/src/utils/lifelinesAuth.js';

describe('lifelinesClerkKey', () => {
  const key = 'pk_test_abc';

  it('gives readers no key, so Clerk never loads for them', () => {
    expect(lifelinesClerkKey({ key, search: '', cookie: '' })).toBeNull();
    expect(lifelinesClerkKey({ key, search: '?q=athanasius', cookie: 'lifelines-layout=vertical' })).toBeNull();
  });

  it('gives the owner the key on ?admin', () => {
    expect(lifelinesClerkKey({ key, search: '?admin', cookie: '' })).toBe(key);
    expect(lifelinesClerkKey({ key, search: '?x=1&admin', cookie: '' })).toBe(key);
  });

  it('gives a signed-in browser the key without the flag', () => {
    expect(lifelinesClerkKey({ key, search: '', cookie: 'a=1; __client_uat=1759680000; b=2' })).toBe(key);
  });

  it('is null with no key configured, whatever the address', () => {
    expect(lifelinesClerkKey({ key: '', search: '?admin', cookie: '' })).toBeNull();
  });
});

describe('hasClerkSession', () => {
  it('reads Clerk’s sign-in timestamp, plain or suffixed', () => {
    expect(hasClerkSession('__client_uat=1759680000')).toBe(true);
    expect(hasClerkSession('x=1; __client_uat_Xy-9z=1759680000')).toBe(true);
  });

  it('treats a zero timestamp, or no cookie, as signed out', () => {
    expect(hasClerkSession('__client_uat=0')).toBe(false);
    expect(hasClerkSession('')).toBe(false);
    expect(hasClerkSession('not__client_uat=123')).toBe(false);
  });
});
