/**
 * Smoke coverage for CH Timeline 2.0.
 *
 * The fixture is deliberately tiny — a figure per layer, an emperor, a council,
 * a text, plus one row of each kind that must now be filtered out — which is
 * enough to exercise what 2.0 does differently from the 1.0 pages it merges:
 *
 *   1. a plain white ground: no manuscript photo, and no parallax field either
 *   2. colour by century, derived from dates, with no eras and no brackets
 *   3. a background layer of reigns, blurred until focused, with a detail panel
 *      that docks beside the timeline rather than covering it
 *   4. heresiarchs hidden and `active = false` rows dropped, connections and all
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installConfigMock, installClerkMock, installSupabaseTableMock } from './fixtures.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const person = (id, name, birth, death, role, extra = {}) => ({
  person_id: id,
  name,
  birth_date: `0${birth}-01-01`,
  death_date: `0${death}-01-01`,
  birth_year: birth,
  death_year: death,
  location: 'Alexandria',
  role_type: 'person',
  // Deliberately stale: 2.0 derives the era from dates and ignores this.
  era_id: 'era-monks-missionaries',
  is_monarch: false,
  monarch_type: null,
  doctrinal_role: role,
  description: `${name} — test fixture.`,
  reference_url: 'https://example.invalid/',
  active: true,
  ...extra,
});

const TABLES = {
  CH_People: [
    // Front layer: a plain figure and a defender.
    person('athanasius', 'Athanasius', 296, 373, 'defender'),
    person('gregory-nyssa', 'Gregory of Nyssa', 335, 395, null),
    // Foreground figure in a much later era, to prove the date-derived remap.
    person('aquinas', 'Thomas Aquinas', 1225, 1274, null),
    // Back layer: a heresiarch, a contested figure and an emperor.
    // Hidden entirely: heresiarchs are off the timeline for now.
    person('arius', 'Arius', 256, 336, 'heresiarch'),
    // Contested figures are ordinary foreground figures again.
    person('origen', 'Origen', 185, 254, 'contested'),
    // Deactivated: must not appear anywhere, nor in anyone's connections.
    person('melanchthon', 'Philipp Melanchthon', 1497, 1560, null, { active: false }),
    person('roman-constantius-2', 'Constantius II', 317, 361, 'emperor-arianizing', {
      role_type: 'emperor',
      is_monarch: true,
      monarch_type: 'roman-unified',
      era_id: null,
      reign_start_year: 337,
      reign_end_year: 361,
    }),
  ],
  CH_Events: [
    {
      event_id: 'council-nicaea', name: 'Council of Nicaea', event_type: 'council',
      event_date: '0325-01-01', end_date: null, location: 'Nicaea',
      description: 'Test fixture.', reference_url: 'https://example.invalid/', active: true,
    },
    {
      event_id: 'doc-on-incarnation', name: 'On the Incarnation', event_type: 'document',
      event_date: '0328-01-01', end_date: null, location: 'Alexandria',
      description: 'Test fixture.', reference_url: null, active: true,
    },
    {
      // Plain events are deactivated for now.
      event_id: 'event-edict-milan', name: 'Edict of Milan', event_type: 'event',
      event_date: '0313-01-01', end_date: null, location: 'Milan',
      description: 'Test fixture.', reference_url: null, active: false,
    },
  ],
  CH_Movements: [
    {
      movement_id: 'mov-arianism', name: 'Arianism', kind: 'heresy',
      start_year: 318, end_year: 381, color: '#c62828',
      description: 'Test fixture.', reference_url: 'https://example.invalid/',
      active: false,
    },
  ],
  CH_Movement_Figures: [
    { id: 1, movement_id: 'mov-arianism', person_id: 'arius', role: 'founder' },
    { id: 2, movement_id: 'mov-arianism', person_id: 'athanasius', role: 'opponent' },
  ],
  CH_Movement_Events: [
    { id: 1, movement_id: 'mov-arianism', event_id: 'council-nicaea', relation: 'condemned_at' },
  ],
  CH_Connections: [
    { connection_id: 1, person_id_1: 'athanasius', person_id_2: 'arius', connection_type: 'opposed' },
    // Points at a deactivated figure: must be dropped, not left dangling.
    { connection_id: 2, person_id_1: 'athanasius', person_id_2: 'melanchthon', connection_type: 'known' },
  ],
  CH_EventConnections: [
    { id: 1, event_id: 'council-nicaea', person_id: 'athanasius' },
  ],
  CH_Sources: [],
  CH_Source_Figures: [],
  CH_Works: [],
  CH_TourScenes: [
    { scene_id: 's1', scene_order: 1, person_ids: ['athanasius'], title: 'Athanasius',
      narrative: 'Scene one.', point_ids: [], is_build_out: false },
    { scene_id: 's2', scene_order: 2, person_ids: ['athanasius', 'gregory-nyssa'], title: 'The Cappadocians',
      narrative: 'Scene two.', point_ids: ['council-nicaea'], is_build_out: false },
  ],
};

async function loadPage(page, { viewport = { width: 1400, height: 900 }, mobile = false, dismissWelcome = true, query = '', at } = {}) {
  await installConfigMock(page, { clerkKey: '' });
  await installClerkMock(page);
  await installSupabaseTableMock(page, TABLES);
  await page.setViewportSize(viewport);
  // A query goes on the clean URL: the .html form redirects to it (here and on
  // Cloudflare Pages), and serve drops the query on the way.
  // `at` loads Lifelines from another address, e.g. the site root.
  const url = at ?? (query ? `/apps/church-history-2${query}` : '/apps/church-history-2.html');
  const response = await page.goto(url);
  expect(response?.status()).toBe(200);

  // Desktop draws to canvas; mobile is a DOM swimlane.
  await expect(page.locator(mobile ? '.mobile-timeline' : 'canvas').first())
    .toBeVisible({ timeout: 15_000 });

  // The tour's welcome dialog covers the page on a first visit and would
  // swallow every click below. Dismissing it is what a reader does too — but
  // the tour test needs it left up, since that is how a tour starts.
  const skip = page.locator('.welcome-btn-secondary');
  if (dismissWelcome && await skip.count()) {
    await skip.click();
    await expect(page.locator('.welcome-overlay')).toHaveCount(0);
  }
}

test.describe('CH Timeline 2.0', () => {
  test.beforeEach(() => {
    const built = path.join(REPO_ROOT, 'apps/church-history-2.html');
    test.skip(!fs.existsSync(built), 'apps/ not built — run `npm run build` first');
  });

  test('renders on white with no manuscript and no parallax field', async ({ page }) => {
    await loadPage(page);

    await expect(page.getByText(/^Error:/)).toHaveCount(0);
    // The manuscript layer is 1.0's; 2.0 must not carry it. Nor the grey-rule
    // parallax field that briefly replaced it — plain white, nothing drifting.
    await expect(page.locator('.timeline-bg-image')).toHaveCount(0);
    await expect(page.locator('.ch2-parallax')).toHaveCount(0);

    const bg = await page.locator('.timeline-container').evaluate(
      el => getComputedStyle(el).backgroundColor
    );
    expect(bg).toBe('rgb(255, 255, 255)');
  });

  // Changed in milestone 3: the colour key (century ramp, swatches, section
  // headings) was removed at the owner's direction. The legend is now
  // Lifelines' name, the four switches, and Windhover at the foot.
  test('legend leads with Lifelines, lists four switches, and signs off with Windhover', async ({ page }) => {
    await loadPage(page);
    const legend = page.locator('.timeline-legend--slim');

    await expect(legend.locator('.legend-site-title')).toContainText('Lifelines');
    await expect(legend.locator('.legend-publisher')).toContainText('Windhover');
    await expect(legend.locator('.legend-publisher')).toContainText("Get a bird's eye view");
    // Name above the switches, publisher below them.
    const titleY = (await legend.locator('.legend-site-title').boundingBox()).y;
    const rowsY = (await legend.locator('.legend-slim-rows').boundingBox()).y;
    const publisherY = (await legend.locator('.legend-publisher').boundingBox()).y;
    expect(titleY).toBeLessThan(rowsY);
    expect(rowsY).toBeLessThan(publisherY);

    const rows = (await legend.locator('.legend-slim-label').allTextContents()).map(t => t.trim());
    expect(rows).toEqual(['Church figures', 'Councils', 'Texts & creeds', 'Emperors & monarchs']);

    // No colour key and no eras, ramp or period rows.
    await expect(page.locator('.legend-century-bar')).toHaveCount(0);
    await expect(page.locator('.legend-color-box')).toHaveCount(0);
    await expect(page.locator('.legend-section-heading')).toHaveCount(0);
    // Each switch is named by its row, so a screen reader hears "Councils".
    await expect(legend.getByRole('checkbox', { name: 'Councils' })).toBeChecked();
  });

  test('legend folds to a Key button while the detail panel is open', async ({ page }) => {
    await loadPage(page);
    await expect(page.locator('.timeline-legend--slim .legend-slim-rows')).toBeVisible();
    const search = page.locator('.timeline-search-input').first();
    await search.fill('Athanasius');
    await page.locator('.timeline-search-dropdown [role="option"]').first().click();
    await expect(page.locator('.timeline-modal--panel')).toBeVisible();

    const key = page.getByRole('button', { name: 'Key' });
    await expect(key).toBeVisible();
    await expect(page.locator('.legend-slim-rows')).toHaveCount(0);
    // The reader can still open it by hand.
    await key.click();
    await expect(page.locator('.legend-slim-rows')).toBeVisible();
  });

  test('hides heresiarchs, keeps contested figures, drops deactivated rows', async ({ page }) => {
    await loadPage(page);
    const search = page.locator('.timeline-search input').first();

    // Contested figures are principals again, not background.
    await search.fill('Origen');
    await expect(page.locator('.timeline-search-option', { hasText: 'Origen' }).first()).toBeVisible();

    // Heresiarchs are off the timeline for now.
    await search.fill('Arius');
    await expect(page.locator('.timeline-search-option')).toHaveCount(0);

    // So is anyone whose Active flag is off, and so are movements.
    await search.fill('Melanchthon');
    await expect(page.locator('.timeline-search-option')).toHaveCount(0);
    await search.fill('Arianism');
    await expect(page.locator('.timeline-search-option')).toHaveCount(0);
    await search.fill('Edict of Milan');
    await expect(page.locator('.timeline-search-option')).toHaveCount(0);
  });

  test('the background layer is blurred and non-interactive at rest', async ({ page }) => {
    await loadPage(page);

    const wash = page.locator('.ch2-layer-wash');
    await expect(wash).toBeVisible();

    const style = await wash.evaluate(el => {
      const cs = getComputedStyle(el);
      return { filter: cs.filter, opacity: Number(cs.opacity), pointerEvents: cs.pointerEvents };
    });
    expect(style.filter).toContain('blur');
    expect(style.opacity).toBeLessThan(1);
    expect(style.pointerEvents).toBe('none');

    // Nothing is focused yet, so the crisp overlay is not mounted.
    await expect(page.locator('.ch2-layer-focus')).toHaveCount(0);
  });

  test('the depth control lifts the whole background layer', async ({ page }) => {
    await loadPage(page);

    const wash = page.locator('.ch2-layer-wash');
    // The filter is transitioned, so poll rather than sampling mid-animation.
    const blurPx = () => wash.evaluate(el => {
      const match = /blur\(([\d.]+)px\)/.exec(getComputedStyle(el).filter);
      return match ? Number(match[1]) : null;
    });
    expect(await blurPx()).toBeGreaterThan(1);

    await page.locator('.depth-btn', { hasText: 'Front' }).click();
    await expect.poll(blurPx, { timeout: 3000 }).toBe(0);

    await page.locator('.depth-btn', { hasText: 'Off' }).click();
    await expect(wash).toHaveCount(0);

    await page.locator('.depth-btn', { hasText: 'Soft' }).click();
    await expect(page.locator('.ch2-layer-wash')).toBeVisible();
  });

  test('selecting a figure docks the detail panel beside a live timeline', async ({ page }) => {
    await loadPage(page);

    const container = page.locator('.timeline-container');
    const widthBefore = (await container.boundingBox()).width;

    // Reach the figure through search rather than hunting for it on canvas.
    const search = page.locator('.timeline-search input').first();
    await search.fill('Athanasius');
    await page.locator('.timeline-search-option', { hasText: 'Athanasius' }).first().click();

    const panel = page.locator('.timeline-modal--panel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.modal-title')).toContainText('Athanasius');

    // A docked panel takes width from the row; a modal would have covered it.
    await expect(page.locator('.modal-backdrop')).toHaveCount(0);
    const widthAfter = (await container.boundingBox()).width;
    expect(widthAfter).toBeLessThan(widthBefore);

    // The timeline stays live — a centred modal freezes it with this class.
    await expect(page.locator('body.modal-open')).toHaveCount(0);

    // Athanasius's background is now in focus: his opponent, his movement and
    // the council he is tied to are drawn crisp on the focus layer.
    await expect(page.locator('.ch2-layer-focus')).toBeVisible();

    // Closing gives the width back.
    await page.locator('.modal-close').click();
    await expect(panel).toHaveCount(0);
    expect((await container.boundingBox()).width).toBeCloseTo(widthBefore, 0);
  });

  // Search has to reach across the layer split, which moved in this round:
  // the background is reigns and nothing else now, while contested figures and
  // the landmarks came forward. What search must NOT return — heresiarchs and
  // deactivated rows — is covered by the removals test above.
  test('search reaches both layers', async ({ page }) => {
    await loadPage(page);
    const search = page.locator('.timeline-search input').first();
    const option = (text) => page.locator('.timeline-search-option', { hasText: text }).first();

    // Foreground: an ordinary figure, and a contested one that used to sit
    // behind the wash and is now a principal.
    await search.fill('Gregory');
    await expect(option('Gregory of Nyssa')).toBeVisible();

    await search.fill('Origen');
    await expect(option('Origen')).toBeVisible();

    // Foreground landmarks: promoted out of the background this round.
    await search.fill('Nicaea');
    await expect(option('Council of Nicaea')).toBeVisible();

    await search.fill('Incarnation');
    await expect(option('On the Incarnation')).toBeVisible();

    // Background: a reign, the only thing still back there.
    await search.fill('Constantius');
    await expect(option('Constantius II')).toBeVisible();
  });

  // Every case above loads with `clerkKey: ''`, which renders the app's
  // unauthenticated branch. The branch that actually ships is the other one,
  // and it shipped broken: ChurchHistory2App calls useAuth whenever a key is
  // present, but the entry point mounted it without a <ClerkProvider>. Nothing
  // in the suite touched that path.
  test('mounts under a ClerkProvider when a publishable key is present', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await installConfigMock(page); // default fixture key — the shipping branch
    await installClerkMock(page);
    await installSupabaseTableMock(page, TABLES);
    await page.setViewportSize({ width: 1400, height: 900 });

    const response = await page.goto('/apps/church-history-2.html');
    expect(response?.status()).toBe(200);

    // Renders at all, and specifically not with a missing-provider throw.
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 });
    expect(pageErrors.filter(e => /ClerkProvider|useAuth/.test(e))).toEqual([]);
    await expect(page.getByText(/^Error:/)).toHaveCount(0);
  });

  // The tour used to render its scene labels and none of its bars. Starting a
  // tour flips the detail variant from the docked panel to a centred modal,
  // and Timeline used to return a different root element for each — so React
  // tore the whole timeline down and rebuilt it, losing the ResizeObserver
  // measurement. The canvases came back 0x0 and painted nothing, while the DOM
  // labels, which do not depend on canvas size, carried on as if fine.
  test('draws lifespans during the tour, not just labels', async ({ page }) => {
    await loadPage(page, { dismissWelcome: false });

    const container = page.locator('.timeline-container');
    const before = await container.evaluate(el => el.dataset.probe = 'original');
    expect(before).toBe('original');

    await page.locator('.welcome-btn-primary').click();      // start the tour
    await expect(page.locator('.tour-panel')).toBeVisible();
    await page.waitForTimeout(2500);

    // The timeline must survive the variant flip rather than remount.
    await expect(container).toHaveAttribute('data-probe', 'original');

    // And its canvases must still be measured, which is what the bug broke.
    const size = await page.locator('.timeline-container canvas').first()
      .evaluate(c => ({ w: c.width, h: c.height }));
    expect(size.w).toBeGreaterThan(0);
    expect(size.h).toBeGreaterThan(0);

    // Finally the thing a reader sees: pixels on the foreground canvas.
    const painted = await page.locator('.timeline-container canvas').last().evaluate(c => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4 * 37) if (d[i] > 8) n++;
      return n;
    });
    expect(painted).toBeGreaterThan(0);
  });

  // A trackpad pinch fires dozens of wheel events in a few frames, and React
  // batches them. The zoom handler used to split the start year and the scale
  // across two setters, nesting one inside the other and returning a stale
  // closed-over start from the outer one; batched, that stale value won the
  // last write and threw the viewport back to where it opened while the zoom
  // carried on. A single pinch self-corrected, which is why only trackpad users
  // hit it. The invariant that catches it: the year under the cursor holds.
  test('a batched trackpad pinch zooms about the cursor, not back to the start', async ({ page }) => {
    await loadPage(page);
    const box = await page.locator('.timeline-container').boundingBox();

    // Sample below the lanes: the readout hides while the cursor is over an item.
    const probeY = box.y + box.height * 0.8;
    const yearAt = async (offsetX) => {
      await page.mouse.move(box.x + offsetX, probeY);
      const readout = page.locator('.cursor-year-display').first();
      await expect(readout).toBeVisible();
      const m = /(-?\d+)\s*(BC|AD)?/i.exec((await readout.textContent()).trim());
      const year = parseInt(m[1], 10);
      return /BC/i.test(m[2] || '') ? -year : year;
    };

    // Zoom in first. This fixture spans only a few centuries, so at the opening
    // scale the visible span is wider than the pannable range and the clamp
    // legitimately pins the viewport — the anchor invariant only means
    // something once the span fits inside the range.
    for (let i = 0; i < 4; i++) {
      await page.locator('button:has-text("Zoom in")').click();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(300);

    const CURSOR_X = 700;
    const before = await yearAt(CURSOR_X);

    // The gesture: ctrlKey wheel events, which is how browsers report a pinch,
    // dispatched back-to-back so they land in a single React pass.
    await page.evaluate(({ x, y }) => {
      const el = document.querySelector('.timeline-container');
      for (let i = 0; i < 12; i++) {
        el.dispatchEvent(new WheelEvent('wheel', {
          deltaY: -4, ctrlKey: true, bubbles: true, cancelable: true, clientX: x, clientY: y,
        }));
      }
    }, { x: box.x + CURSOR_X, y: probeY });
    await page.waitForTimeout(400);

    const after = await yearAt(CURSOR_X);

    // The year under the cursor is the anchor the zoom pivots about.
    expect(Math.abs(after - before)).toBeLessThan(15);
  });

  // Inline editing is admin-only. RLS is the real boundary — only an admin can
  // UPDATE CH_People — but the affordance must not appear for anyone else
  // either, or a reader is invited to make a change that cannot land.
  test('shows no edit affordance to a reader who is not an admin', async ({ page }) => {
    await loadPage(page);

    // Open a figure, so the whole detail panel is on screen to inspect.
    const search = page.locator('.timeline-search input').first();
    await search.fill('Athanasius');
    await page.locator('.timeline-search-option').first().click();
    await expect(page.locator('.timeline-modal--panel')).toBeVisible();

    await expect(page.locator('.editable-pencil')).toHaveCount(0);
    await expect(page.locator('.editable-popover')).toHaveCount(0);

    // The text itself still renders — the gate hides the pencil, not the panel.
    await expect(page.locator('.modal-title')).toContainText('Athanasius');

    // And hovering the title must not summon one.
    await page.locator('.modal-title').hover();
    await page.waitForTimeout(250);
    await expect(page.locator('.editable-pencil')).toHaveCount(0);
  });

  test('mobile falls back to the 1.0 swimlane', async ({ page }) => {
    await loadPage(page, { viewport: { width: 390, height: 844 }, mobile: true });

    await expect(page.locator('.mobile-timeline')).toBeVisible();
    // No depth stack on mobile — the background layer is a desktop affordance.
    await expect(page.locator('.ch2-layer-wash')).toHaveCount(0);
    await expect(page.locator('.ch2-parallax')).toHaveCount(0);
  });
});

test.describe('Lifelines release fixes (milestone 1)', () => {
  test.beforeEach(() => {
    const built = path.join(REPO_ROOT, 'apps/church-history-2.html');
    test.skip(!fs.existsSync(built), 'apps/ not built — run `npm run build` first');
  });

  test('opens on the early church and says which years are in view', async ({ page }) => {
    await loadPage(page);
    // The configured 1–500 window, framed against the real canvas width. It
    // used to open on AD 750–1650 with a "1.6x" readout, because the frame
    // was computed from the first render's 800px placeholder.
    await expect(page.locator('.zoom-info')).toHaveText('1–500 AD');
  });

  test('shows readers no navigation and no sign-in', async ({ page }) => {
    await loadPage(page);
    await expect(page.locator('.site-nav-toggle')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /sign/i })).toHaveCount(0);
    // The logo is no longer a link back to a homepage Lifelines has replaced.
    await expect(page.locator('a.header-bird-link')).toHaveCount(0);
  });

  test('?admin brings the account controls back', async ({ page }) => {
    await loadPage(page, { query: '?admin' });
    // No Clerk key in tests, so the admin slot shows its unconfigured state.
    await expect(page.getByRole('button', { name: 'Sign-in unavailable' })).toBeVisible();
  });

  test('welcomes readers to Lifelines by name', async ({ page }) => {
    await loadPage(page, { dismissWelcome: false });
    await expect(page.locator('.welcome-title')).toHaveText('Welcome to Lifelines');
  });

  test('holds its light palette when the OS is in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await loadPage(page);
    // Shared .btn rules turn buttons near-black under a dark OS; Lifelines
    // opts out with <html data-theme="light">. Read the computed colour of a
    // header button and of the legend text rather than trusting the class.
    const tour = page.getByRole('button', { name: /Tour/ });
    const bg = await tour.evaluate(el => getComputedStyle(el).backgroundColor);
    const [r, g, b] = bg.match(/\d+/g).map(Number);
    expect(Math.min(r, g, b)).toBeGreaterThan(200);
    const legend = await page.locator('.legend-slim-label').first().evaluate(el => getComputedStyle(el).color);
    const [lr, lg, lb] = legend.match(/\d+/g).map(Number);
    expect(Math.max(lr, lg, lb)).toBeLessThan(140);
  });

  test('on a phone, the header sits above the timeline toolbar, not over it', async ({ page }) => {
    await loadPage(page, { viewport: { width: 390, height: 844 }, mobile: true });
    // The header used to float over the page and hide Filter, zoom and the
    // years readout entirely.
    const header = await page.locator('.app-header').boundingBox();
    const toolbar = await page.locator('.mobile-timeline-toolbar').boundingBox();
    expect(toolbar.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
    await expect(page.locator('.mobile-zoom-label')).toHaveText(/AD/);
  });

  test('on a phone, the years readout follows zooming', async ({ page }) => {
    await loadPage(page, { viewport: { width: 390, height: 844 }, mobile: true });
    const label = page.locator('.mobile-zoom-label');
    await expect(label).toHaveText(/AD/);
    const before = await label.textContent();
    // Zoom out twice: more years on screen, so the range must widen each time.
    const zoomOut = page.locator('.mobile-zoom-controls .mobile-toolbar-btn').first();
    await zoomOut.click();
    await expect(label).not.toHaveText(before);
    const mid = await label.textContent();
    await zoomOut.click();
    await expect(label).not.toHaveText(mid);
  });
});

test.describe('Lifelines as the front page (milestone 2)', () => {
  test.beforeEach(() => {
    const built = path.join(REPO_ROOT, 'apps/church-history-2.html');
    test.skip(!fs.existsSync(built), 'apps/ not built — run `npm run build` first');
  });

  // Locally this goes through serve.json; in production through _redirects.
  // tests/unit/site-routing.test.js keeps the two rules identical.
  test('the site root is Lifelines, with its scripts and styles loading', async ({ page }) => {
    const failed = [];
    page.on('response', r => { if (r.url().includes('/apps/assets/') && r.status() >= 400) failed.push(r.url()); });
    await loadPage(page, { at: '/', dismissWelcome: false });
    await expect(page.locator('.welcome-title')).toHaveText('Welcome to Lifelines');
    await expect(page).toHaveURL(/\/$/);
    // Relative asset paths would have resolved to /assets/ here and 404'd.
    expect(failed).toEqual([]);
  });

  test('/?admin keeps its query and shows the account slot', async ({ page }) => {
    await loadPage(page, { at: '/?admin' });
    await expect(page.getByRole('button', { name: 'Sign-in unavailable' })).toBeVisible();
  });

  test('an unknown address gets a 404 page that leads back to Lifelines', async ({ page }) => {
    const response = await page.goto('/no-such-page');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to Lifelines' })).toHaveAttribute('href', '/');
  });
});

test.describe('Review round fixes (milestone 3)', () => {
  test.beforeEach(() => {
    const built = path.join(REPO_ROOT, 'apps/church-history-2.html');
    test.skip(!fs.existsSync(built), 'apps/ not built — run `npm run build` first');
  });

  test('moving into the header leaves no hover card or year chip behind', async ({ page }) => {
    await loadPage(page);
    // Sweep across the timeline (showing the year chip, and hovering whatever
    // lies under the path), then up into the header. The header is a solid
    // bar on Lifelines, so it must not hover the figures hidden behind it.
    await page.mouse.move(300, 400);
    await expect(page.locator('.cursor-year-display')).toBeVisible();
    await page.mouse.move(700, 20, { steps: 8 });
    await expect(page.locator('.cursor-year-display')).toHaveCount(0);
    await expect(page.locator('.hover-preview')).toHaveCount(0);
  });
});

