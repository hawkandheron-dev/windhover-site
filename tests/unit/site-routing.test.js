/**
 * The site's front page is Lifelines, served at "/" by a Cloudflare Pages
 * proxy rule in _redirects. The local test server (npx serve) cannot read that
 * file, so serve.json repeats the rule. If the two drift, e2e tests pass
 * against a front page production doesn't serve. These checks are about the
 * files, not the network: the deployed behaviour is checked on the preview.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/** Non-comment, non-blank lines of _redirects, split into fields. */
function redirectRules() {
  return read('_redirects')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.split(/\s+/));
}

/** _headers as [{ path, lines[] }], comments dropped. */
function headerBlocks() {
  const blocks = [];
  for (const raw of read('_headers').split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) blocks.push({ path: raw.trim(), lines: [] });
    else blocks.at(-1).lines.push(raw.trim());
  }
  return blocks;
}

describe('front page routing', () => {
  it('serves Lifelines at "/" with a 200 proxy, not a redirect', () => {
    const root = redirectRules().find(([src]) => src === '/');
    expect(root).toEqual(['/', '/apps/church-history-2', '200']);
  });

  it('also serves Lifelines at /lifelines, its canonical address', () => {
    // windhoverhistory.com/lifelines (owner, 2026-10-08); with and without
    // the trailing slash, both as 200 proxies.
    for (const src of ['/lifelines', '/lifelines/']) {
      expect(redirectRules().find(([s]) => s === src)).toEqual([src, '/apps/church-history-2', '200']);
    }
  });

  it('mirrors every rule in serve.json for the local test server', () => {
    const { rewrites } = JSON.parse(read('serve.json'));
    // Same page either way: serve wants the file, Pages the clean URL.
    expect(rewrites).toEqual(redirectRules().map(([source, target]) => ({ source, destination: `${target}.html` })));
  });

  it('leaves no root index.html to compete with the rule', () => {
    expect(fs.existsSync(path.join(ROOT, 'index.html'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'home.html'))).toBe(true);
  });

  it('has a 404 page, so unknown URLs stop falling back to a homepage', () => {
    expect(read('404.html')).toMatch(/Page not found/);
  });
});

describe('search indexing', () => {
  it('marks every page noindex by default', () => {
    const all = headerBlocks().find(b => b.path === '/*');
    expect(all.lines).toContain('X-Robots-Tag: noindex');
  });

  it("lets Lifelines' public addresses — and only those — drop it", () => {
    const detaching = headerBlocks().filter(b => b.lines.includes('! X-Robots-Tag'));
    expect(detaching.map(b => b.path)).toEqual(['/', '/lifelines', '/lifelines/']);
  });

  it('does not disallow crawling, which would hide the noindex header', () => {
    expect(read('robots.txt')).not.toMatch(/^Disallow:\s*\/\S*/m);
  });
});
