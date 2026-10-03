#!/usr/bin/env node
/**
 * Render Lifelines and screenshot it, so UI work is judged on pixels rather
 * than on JSX.
 *
 *   npm run build                  # the shots are of apps/, not of src/
 *   npm run shots                  # every state at every viewport
 *   npm run shots -- --only panel  # states whose name contains "panel"
 *
 * Output goes to .shots/lifelines/ (gitignored): one PNG per state, an
 * index.html contact sheet, and report.md with any console errors.
 *
 * Why it works offline. The cloud sandbox cannot reach Supabase, the deployed
 * site or Google Fonts, and the e2e fixture is seven people — too few to show
 * the density problems that matter here (three past bugs only appeared with
 * the full dataset). So:
 *   - data is replayed from tests/e2e/data/lifelines-snapshot.json, a copy of
 *     the real CH_ tables. Refresh it with scripts/lifelines-snapshot.sql
 *     when the data changes materially.
 *   - Cormorant and Alegreya Sans are served from @fontsource, so type renders
 *     as it does in production rather than falling back to Georgia.
 *   - everything else external (Wikipedia, images, Turnstile) is aborted, so
 *     those areas show their empty or error state. Say so when reporting.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { installConfigMock, installClerkMock, installSupabaseTableMock } from '../tests/e2e/fixtures.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = '/apps/church-history-2.html';
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const OUT = path.resolve(ROOT, opt('out') || '.shots/lifelines');
const ONLY = opt('only');

// Widths chosen at the edges that matter: 390 is a current phone; 820 is an
// iPad in portrait, just above the 768px mobile switch, so it gets the desktop
// canvas at its most cramped; 1280x720 is a small laptop with browser chrome;
// 1440x900 is the comfortable case.
const VIEWPORTS = {
  phone:   { width: 390,  height: 844,  mobile: true },
  'phone-large': { width: 430, height: 932, mobile: true },
  tablet:  { width: 820,  height: 1180, mobile: false },
  laptop:  { width: 1280, height: 720,  mobile: false },
  desktop: { width: 1440, height: 900,  mobile: false },
};

// A figure with connections, works and a long description: the panel at its fullest.
const PANEL_QUERY = 'Athanasius';

const DEFAULT_STATES = [
  { name: 'first-visit',   viewports: ['phone', 'laptop', 'desktop'], welcome: true },
  { name: 'default',       viewports: ['phone', 'tablet', 'laptop', 'desktop'] },
  { name: 'default-dark',  viewports: ['phone', 'desktop'], colorScheme: 'dark' },
  { name: 'panel',         viewports: ['phone', 'tablet', 'laptop', 'desktop'], act: openPanel },
  { name: 'search',        viewports: ['phone', 'desktop'], act: openSearch },
  { name: 'keyboard-focus', viewports: ['desktop'], act: tabThrough },
  // The other layout from the toggle: vertical on wide screens, horizontal on a phone.
  { name: 'vertical',      viewports: ['tablet', 'desktop'], layout: 'vertical' },
  // Leaving the tour: the rest of the timeline sweeps in left to right.
  { name: 'tour-exit-mid',  viewports: ['desktop'], welcome: true, act: tourExit(450) },
  { name: 'tour-exit-end',  viewports: ['desktop'], welcome: true, act: tourExit(2200) },
  { name: 'horizontal',    viewports: ['phone'], layout: 'horizontal' },
];

// --compare points: the harp-strings prototype against today's pins and
// flags, at three zoom levels and with a figure focused. Desktop only; the
// phone comparison is --compare mobile (milestone 3, step 9).
const zoom = (label, times) => async (page) => {
  for (let i = 0; i < times; i++) {
    await page.getByRole('button', { name: label }).click();
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(300);
};
const POINT_STYLES = [['flags', ''], ['strings', '?points=strings']];
const COMPARE_POINTS = POINT_STYLES.flatMap(([style, query]) => [
  { name: `points-${style}-opening`,    viewports: ['desktop', 'laptop'], query },
  { name: `points-${style}-zoomed-in`,  viewports: ['desktop'], query, act: zoom('Zoom in', 2) },
  { name: `points-${style}-zoomed-out`, viewports: ['desktop'], query, act: zoom('Zoom out', 2) },
  { name: `points-${style}-focused`,    viewports: ['desktop'], query, act: openPanel },
]);

// --compare mobile: today's vertical phone timeline against the desktop's
// horizontal one on a phone (chosen with the layout toggle; detail as a modal).
const zoomInEither = async (page) => {
  const named = page.getByRole('button', { name: 'Zoom in' });
  if (await named.count()) return zoom('Zoom in', 2)(page);
  // The vertical phone toolbar's zoom buttons are icon-only: −, readout, +.
  for (let i = 0; i < 2; i++) {
    await page.locator('.mobile-zoom-controls button').nth(1).click();
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(300);
};
const PHONE_LAYOUTS = ['vertical', 'horizontal'];
const COMPARE_MOBILE = PHONE_LAYOUTS.flatMap(layout => [
  { name: `mobile-${layout}-opening`,   viewports: ['phone', 'phone-large'], layout },
  { name: `mobile-${layout}-zoomed-in`, viewports: ['phone', 'phone-large'], layout, act: zoomInEither },
  { name: `mobile-${layout}-detail`,    viewports: ['phone', 'phone-large'], layout, act: openPanel },
]);

const COMPARE = opt('compare');
const STATES = COMPARE === 'points' ? COMPARE_POINTS
  : COMPARE === 'mobile' ? COMPARE_MOBILE
  : DEFAULT_STATES;

// ── tiny static server over the repo root (apps/ plus node_modules fonts) ──
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
function serve() {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end();
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, () => r(server)));
}

function fontCss(base) {
  const faces = [];
  for (const [family, pkg, weights] of [
    ['Cormorant', 'cormorant', [300, 400, 500, 600, 700]],
    ['Alegreya Sans', 'alegreya-sans', [300, 400, 500, 700]],
  ]) {
    for (const w of weights) for (const style of ['normal', 'italic']) {
      faces.push(`@font-face{font-family:'${family}';font-style:${style};font-weight:${w};font-display:swap;` +
        `src:url(${base}/node_modules/@fontsource/${pkg}/files/${pkg}-latin-${w}-${style}.woff2) format('woff2');}`);
    }
  }
  return faces.join('\n');
}

function loadTables() {
  const snap = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/e2e/data/lifelines-snapshot.json'), 'utf8'));
  delete snap._meta;
  return snap;
}

// ── state actions ──
async function openPanel(page, vp) {
  await openSearch(page, vp);
  const option = page.locator('.timeline-search-dropdown [role="option"]').first();
  await option.click();
  await page.waitForTimeout(600); // panel slide + depth transition
}
async function openSearch(page) {
  const input = page.locator('.timeline-search-input').first();
  await input.click();
  await input.fill(PANEL_QUERY.slice(0, 4));
  await page.waitForTimeout(250);
}
function tourExit(afterMs) {
  return async (page) => {
    await page.getByRole('button', { name: 'Take the Tour' }).click();
    await page.waitForTimeout(1200);
    for (let i = 0; i < 2; i++) { await page.locator('[title="Next (→)"]').click(); await page.waitForTimeout(900); }
    await page.locator('[title="Exit tour"]').click();
    await page.waitForTimeout(afterMs);
  };
}
async function tabThrough(page) {
  for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
  await page.waitForTimeout(150);
}

async function shoot(browser, base, tables, state, vpName) {
  const vp = VIEWPORTS[vpName];
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.mobile ? 2 : 1,
    isMobile: vp.mobile, hasTouch: vp.mobile,
    colorScheme: state.colorScheme || 'light',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  let aborted = 0;
  page.on('requestfailed', r => { if (!/localhost|127\.0\.0\.1/.test(r.url())) aborted++; });
  page.on('console', m => {
    // An aborted external request also logs a generic console error; those are
    // counted above, not reported as faults.
    if (m.type() === 'error' && !m.text().includes('net::ERR_FAILED')) errors.push(`console: ${m.text()}`);
  });

  // Order matters: Playwright tries the most recently added route first, so
  // the catch-all abort goes in before the specific mocks.
  await page.route(u => !u.host.startsWith('localhost') && !u.host.startsWith('127.0.0.1'), r => r.abort());
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: fontCss(base) }));
  await installConfigMock(page, { clerkKey: '' });
  await installClerkMock(page);
  await installSupabaseTableMock(page, tables);

  // A state may preset the reader's remembered layout (the layout toggle).
  if (state.layout) {
    await page.addInitScript(l => { try { localStorage.setItem('lifelines-layout', l); } catch { /* none */ } }, state.layout);
  }
  await page.goto(base + PAGE + (state.query || ''));
  await page.locator('.mobile-timeline, canvas').first().waitFor({ timeout: 15_000 }).catch(() => {
    errors.push('timeline did not render within 15s');
  });
  await page.evaluate(() => document.fonts.ready);

  const skip = page.locator('.welcome-btn-secondary');
  if (!state.welcome && await skip.count()) await skip.click();
  // Park the pointer over the header so the shot doesn't catch a hover card
  // left behind by whatever sat under the Skip button.
  await page.mouse.move(vp.width / 2, 4);
  await page.waitForTimeout(400);

  let note = '';
  if (state.act) {
    try { await state.act(page, vp); } catch (e) { note = `action failed: ${e.message.split('\n')[0]}`; }
  }
  const file = `${state.name}--${vpName}.png`;
  await page.screenshot({ path: path.join(OUT, file) });
  await context.close();
  return { file, state: state.name, viewport: `${vpName} ${vp.width}×${vp.height}`, errors, note, aborted };
}

async function main() {
  if (!fs.existsSync(path.join(ROOT, 'apps/church-history-2.html'))) {
    console.error('apps/ is missing — run `npm run build` first.');
    process.exit(1);
  }
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const tables = loadTables();
  const server = await serve();
  const base = `http://localhost:${server.address().port}`;
  // CHROMIUM_PATH lets a sandbox with a preinstalled browser skip
  // `playwright install` (Claude's cloud sessions: /opt/pw-browsers/chromium).
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const results = [];
  try {
    for (const state of STATES) {
      if (ONLY && !ONLY.split(',').some(o => state.name.includes(o))) continue;
      for (const vp of state.viewports) {
        const r = await shoot(browser, base, tables, state, vp);
        results.push(r);
        console.log(`${r.errors.length || r.note ? '!' : '✓'} ${r.file}${r.note ? '  ' + r.note : ''}`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  const md = ['# Lifelines screenshots', '', 'Data: real snapshot (tests/e2e/data/lifelines-snapshot.json). External services aborted.', ''];
  for (const r of results) {
    md.push(`- **${r.state}** @ ${r.viewport} → \`${r.file}\`${r.note ? ` — ${r.note}` : ''}${r.aborted ? ` (${r.aborted} external request(s) blocked)` : ''}`);
    for (const e of r.errors) md.push(`  - ${e.slice(0, 300)}`);
  }
  fs.writeFileSync(path.join(OUT, 'report.md'), md.join('\n') + '\n');
  const cards = results.map(r =>
    `<figure><a href="${r.file}"><img src="${r.file}" loading="lazy"></a><figcaption><b>${r.state}</b> ${r.viewport}` +
    `${r.errors.length ? ` · ${r.errors.length} error(s)` : ''}${r.note ? ` · ${r.note}` : ''}</figcaption></figure>`).join('\n');
  fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html><meta charset=utf-8><title>Lifelines shots</title>
<style>body{font:14px system-ui;margin:16px;background:#eee}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:16px}
figure{margin:0;background:#fff;padding:8px;border-radius:6px}img{width:100%;border:1px solid #ccc}</style><main>${cards}</main>`);
  console.log(`\n${results.length} shots → ${path.relative(ROOT, OUT)}/ (index.html, report.md)`);
}

main().catch(e => { console.error(e); process.exit(1); });
