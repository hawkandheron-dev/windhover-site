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

async function loadPage(page, { viewport = { width: 1400, height: 900 }, mobile = false, dismissWelcome = true } = {}) {
  await installConfigMock(page, { clerkKey: '' });
  await installClerkMock(page);
  await installSupabaseTableMock(page, TABLES);
  await page.setViewportSize(viewport);
  const response = await page.goto('/apps/church-history-2.html');
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

  test('legend shows a century ramp and a short key, not eras or periods', async ({ page }) => {
    await loadPage(page);

    // Colour means century now, shown as a ramp rather than sixteen rows.
    await expect(page.locator('.legend-century-bar')).toHaveCount(1);
    const ticks = await page.locator('.legend-century-ticks span').allTextContents();
    expect(ticks[0]).toBe('1st');
    expect(ticks[ticks.length - 1]).toBe('16th');

    const headings = page.locator('.legend-section-heading');
    expect((await headings.allTextContents()).map(t => t.trim()))
      .toEqual(['Figures', 'Landmarks', 'Background']);

    const rows = (await page.locator('.legend-item').allTextContents()).map(t => t.trim());
    expect(rows).toEqual(['Church figures', 'Councils', 'Texts & creeds', 'Emperors & monarchs']);

    // None of the era rows survive, and neither does 1.0's generic "Period".
    for (const gone of ['The Apostolic Age', 'Early Middle Ages', 'Renaissance & Reformation']) {
      await expect(page.locator('.legend-item', { hasText: gone })).toHaveCount(0);
    }
    await expect(page.locator('.legend-item').filter({ hasText: /^Period$/ })).toHaveCount(0);
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

  test('mobile falls back to the 1.0 swimlane', async ({ page }) => {
    await loadPage(page, { viewport: { width: 390, height: 844 }, mobile: true });

    await expect(page.locator('.mobile-timeline')).toBeVisible();
    // No depth stack on mobile — the background layer is a desktop affordance.
    await expect(page.locator('.ch2-layer-wash')).toHaveCount(0);
    await expect(page.locator('.ch2-parallax')).toHaveCount(0);
  });
});
