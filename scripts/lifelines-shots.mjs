#!/usr/bin/env node
/**
 * Render Lifelines and screenshot it, so UI work is judged on pixels rather
 * than on JSX.
 *
 *   npm run build                  # the shots are of apps/, not of src/
 *   npm run shots                  # every state at every viewport
 *   npm run shots -- --only panel  # states whose name contains "panel"
 *   npm run shots -- --share       # remake the share card image
 *                                  # (timeline-scratch/public/lifelines-share.png)
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
const SHARE = args.includes('--share');
const SHARE_IMAGE = path.join(ROOT, 'timeline-scratch/public/lifelines-share.png');

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
  // A Retina laptop: the same CSS size as laptop at twice the pixels, to see
  // the canvas drawn at full density (hiDpiCanvas, M4).
  retina:  { width: 1280, height: 720,  mobile: false, scale: 2 },
  // The share card: Open Graph's 1200x630, drawn from a 1500x788 layout at
  // 0.8x, so the stacks of figures above the axis have room to show.
  share:   { width: 1500, height: 788,  mobile: false, scale: 0.8 },
};

// A figure with connections, works and a long description: the panel at its fullest.
const PANEL_QUERY = 'Athanasius';

const DEFAULT_STATES = [
  { name: 'first-visit',   viewports: ['phone', 'laptop', 'desktop'], welcome: true },
  { name: 'default',       viewports: ['phone', 'tablet', 'laptop', 'desktop', 'retina'] },
  { name: 'default-dark',  viewports: ['phone', 'desktop'], colorScheme: 'dark' },
  { name: 'panel',         viewports: ['phone', 'tablet', 'laptop', 'desktop'], act: openPanel },
  { name: 'search',        viewports: ['phone', 'desktop'], act: openSearch },
  { name: 'keyboard-focus', viewports: ['desktop'], act: tabThrough },
  // The other layout from the toggle: vertical on wide screens, horizontal on a phone.
  { name: 'vertical',      viewports: ['tablet', 'desktop'], layout: 'vertical' },
  // Leaving the tour: the rest of the timeline sweeps in left to right.
  { name: 'tour-exit-mid',  viewports: ['desktop'], welcome: true, act: tourExit(450) },
  { name: 'tour-exit-end',  viewports: ['desktop'], welcome: true, act: tourExit(2200) },
  // The tour itself, a few scenes in (a bottom sheet on phones).
  { name: 'tour',           viewports: ['phone', 'desktop'], welcome: true, act: tourScene(2) },
  { name: 'tour-later',     viewports: ['phone'], welcome: true, act: tourScene(6) },
  { name: 'tour-horizontal', viewports: ['phone'], welcome: true, layout: 'horizontal', act: tourScene(2) },
  // Scene 7 opens Irenaeus: on a phone, a short card above the sheet.
  { name: 'tour-later-horizontal', viewports: ['phone'], welcome: true, layout: 'horizontal', act: tourScene(6) },
  { name: 'horizontal',    viewports: ['phone'], layout: 'horizontal' },
  // The data fails to load: a plain sentence and "Try again" (M4).
  { name: 'about',         viewports: ['phone', 'desktop'], act: openAbout },
  { name: 'error',         viewports: ['phone', 'desktop'], failData: true },
];

// Zoom with the named buttons (the horizontal timeline's controls).
const zoom = (label, times) => async (page) => {
  for (let i = 0; i < times; i++) {
    await page.getByRole('button', { name: label }).click();
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(300);
};

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
// --compare points (flags against strings) went when strings became the
// config default and ?points=strings stopped meaning anything (PR #160).
// The share card: the real opening view, without the page's controls, and
// the name set over the empty early centuries at the top left.
const SHARE_STATE = {
  name: 'share', viewports: ['share'], act: shareCard,
  css: `.app-header, .timeline-legend, .timeline-controls, .zoom-controls,
        .cursor-year-display, .ch2-skip-link { display: none !important; }`,
};

const STATES = SHARE ? [SHARE_STATE] : COMPARE === 'mobile' ? COMPARE_MOBILE : DEFAULT_STATES;

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
  // Tour pictures come from CH_LinkedMedia, which the snapshot doesn't carry,
  // and from Wikimedia, which the sandbox can't reach: give every scene a
  // stand-in so the tour panel's picture layout can be seen at all.
  snap.CH_LinkedMedia = (snap.CH_TourScenes || []).map((scene, i) => ({
    media_id: `stand-in-${i}`, entity_type: 'tour_scene', entity_id: scene.scene_id,
    media_url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Stand-in.jpg',
    alt_text: 'Stand-in picture', attribution: 'Stand-in (screenshots only)', sort_order: 0,
  }));
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
function tourScene(n) {
  return async (page) => {
    await page.getByRole('button', { name: 'Take the Tour' }).click();
    await page.waitForTimeout(1200);
    for (let i = 0; i < n; i++) { await page.locator('[title="Next (→)"]').click(); await page.waitForTimeout(900); }
    await page.waitForTimeout(600);
  };
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
async function shareCard(page) {
  const logo = 'data:image/png;base64,' +
    fs.readFileSync(path.join(ROOT, 'resources/logos/Windhover_BLK-small.png')).toString('base64');
  // The name goes in the empty band between the texts and the rulers' strip,
  // where it covers no one.
  const band = await page.evaluate(() => {
    const strip = document.querySelector('.ruler-strip')?.getBoundingClientRect();
    return { bottom: strip ? strip.top : innerHeight };
  });
  await page.evaluate(({ logo, bottom }) => {
    const card = document.createElement('div');
    card.innerHTML = `
      <div style="font: 700 92px/1 'Alegreya Sans', sans-serif; color: #23231f; letter-spacing: -1px">Lifelines</div>
      <div style="border-left: 1px solid rgba(30,28,24,0.18); padding-left: 28px">
        <div style="font: 400 31px/1.2 'Alegreya Sans', sans-serif; color: #45453e">A church history timeline by lifespans</div>
        <div style="display: flex; align-items: center; gap: 10px; margin-top: 12px;
                    font: 700 18px/1 'Alegreya Sans', sans-serif; letter-spacing: 1.6px; color: #45453e">
          <img src="${logo}" style="height: 24px" alt=""> WINDHOVER
        </div>
      </div>`;
    Object.assign(card.style, {
      position: 'fixed', left: '56px', bottom: `${innerHeight - bottom + 26}px`, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: '28px', padding: '22px 34px',
      background: 'rgba(255,255,255,0.96)', borderRadius: '10px',
      boxShadow: '0 6px 28px rgba(20,20,16,0.10)', border: '1px solid rgba(30,28,24,0.12)',
    });
    document.body.appendChild(card);
  }, { logo, bottom: band.bottom });
  await page.waitForTimeout(300);
}
async function openAbout(page) {
  await page.getByRole('button', { name: 'About' }).click();
  await page.waitForTimeout(200);
}
async function tabThrough(page) {
  for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
  await page.waitForTimeout(150);
}

async function shoot(browser, base, tables, state, vpName) {
  const vp = VIEWPORTS[vpName];
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.scale ?? (vp.mobile ? 2 : 1),
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
  await page.route('**/commons.wikimedia.org/**', r => r.fulfill({
    status: 200, contentType: 'image/jpeg',
    body: fs.readFileSync(path.join(ROOT, 'resources/Bodleian-Library-MS-Laud-Misc-388_00001_fol-016v.jpg')),
  }));
  await installConfigMock(page, { clerkKey: '' });
  await installClerkMock(page);
  await installSupabaseTableMock(page, tables);
  // A state may make the data fail, to show the error screen.
  if (state.failData) {
    await page.route('**/*.supabase.co/**', r => r.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
  }

  // A state may restyle the page from its first paint (the share card hides
  // the page's controls, so the timeline lays out without them).
  if (state.css) {
    await page.addInitScript(css => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
      });
    }, state.css);
  }
  // A state may preset the reader's remembered layout (the layout toggle).
  if (state.layout) {
    await page.addInitScript(l => { try { localStorage.setItem('lifelines-layout', l); } catch { /* none */ } }, state.layout);
  }
  await page.goto(base + PAGE + (state.query || ''));
  await page.locator(state.failData ? '[role="alert"]' : '.mobile-timeline, canvas').first().waitFor({ timeout: 15_000 }).catch(() => {
    errors.push(state.failData ? 'error screen did not render within 15s' : 'timeline did not render within 15s');
  });
  await page.evaluate(() => document.fonts.ready);

  const skip = page.locator('.welcome-btn-secondary');
  if (!state.welcome && await skip.count()) await skip.click();
  // Park the pointer over the header so the shot doesn't catch a hover card
  // left behind by whatever sat under the Skip button. (The share card hides
  // the header, so there it stays where it started, off the timeline.)
  if (!state.css) await page.mouse.move(vp.width / 2, 4);
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

  if (SHARE) {
    fs.copyFileSync(path.join(OUT, 'share--share.png'), SHARE_IMAGE);
    console.log(`share card → ${path.relative(ROOT, SHARE_IMAGE)}`);
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
