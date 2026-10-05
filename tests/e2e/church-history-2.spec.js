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
const SNAPSHOT = (() => {
  const snap = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tests/e2e/data/lifelines-snapshot.json'), 'utf8'));
  delete snap._meta;
  return snap;
})();

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
    // A second figure at Nicaea, so its string carries two dots.
    person('eusebius', 'Eusebius of Caesarea', 260, 339, null),
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
    // Round 5: landmarks are major or minor; minor ones are hidden.
    {
      event_id: 'event-fire-rome', name: 'Great Fire of Rome', event_type: 'event',
      event_date: '0064-01-01', end_date: null, location: 'Rome',
      description: 'Test fixture.', reference_url: null, active: true, significance: 'major',
    },
    {
      event_id: 'event-hagia-sophia', name: 'Hagia Sophia consecrated', event_type: 'event',
      event_date: '0360-01-01', end_date: null, location: 'Constantinople',
      description: 'Test fixture.', reference_url: null, active: true, significance: 'minor',
    },
    {
      event_id: 'council-arles-314', name: 'Council of Arles', event_type: 'council',
      event_date: '0314-01-01', end_date: null, location: 'Arles',
      description: 'Test fixture.', reference_url: null, active: true, significance: 'minor',
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
    { id: 2, event_id: 'council-nicaea', person_id: 'eusebius' },
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

async function loadPage(page, { viewport = { width: 1400, height: 900 }, mobile = false, dismissWelcome = true, query = '', at, realData = false } = {}) {
  await installConfigMock(page, { clerkKey: '' });
  await installClerkMock(page);
  // realData: the snapshot of the live tables, for checks that only mean
  // something at real density (the fixture has seven people).
  await installSupabaseTableMock(page, realData ? SNAPSHOT : TABLES);
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
  test('legend leads with Lifelines, lists five switches, and signs off with Windhover', async ({ page }) => {
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
    // Round 5 brought the major events back, with their own switch.
    expect(rows).toEqual(['Church figures', 'Councils', 'Events', 'Texts & creeds', 'Emperors & monarchs']);

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

  // The rulers (round 6, owner's pick): a strip pinned to the foot of the
  // timeline, not a band under the axis. The blurred band, then the "crisp
  // and quiet" band and the Rulers control, were each tried and retired; the
  // tests that asserted them went with them.
  test('the rulers sit in a strip at the foot, above which the controls sit', async ({ page }) => {
    await loadPage(page);
    const strip = page.locator('.ruler-strip');
    await expect(strip).toBeVisible();
    await expect(page.locator('.ch2-layer-wash')).toHaveCount(0);
    await expect(page.locator('.depth-controls')).toHaveCount(0);
    await expect(strip.getByText('Constantius II')).toBeVisible();
    const s = await strip.boundingBox();
    const viewport = page.viewportSize();
    expect(s.y + s.height).toBeGreaterThan(viewport.height - 2);
    const controls = await page.locator('.timeline-controls').boundingBox();
    expect(controls.y + controls.height).toBeLessThanOrEqual(s.y);
    // A ruler in the strip opens like any figure.
    await strip.getByText('Constantius II').click();
    await expect(page.locator('.timeline-modal--panel .modal-title')).toContainText('Constantius II');
  });

  for (const viewport of [{ width: 820, height: 1180 }, { width: 1440, height: 900 }]) {
    test(`ruler names in the strip never overlap one another (${viewport.width}px, real data)`, async ({ page }) => {
      // With all five rows full a reign shares a row, and its name was
      // written over the next one ("Decius" over "Valerian"); it is cut now.
      await loadPage(page, { viewport, realData: true });
      const overlaps = await page.locator('.ruler-strip').evaluate(strip => {
        const names = [...strip.querySelectorAll('.ruler-strip-name')].map(el => el.getBoundingClientRect());
        let n = 0;
        names.forEach((a, i) => names.slice(i + 1).forEach(b => {
          if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) n++;
        }));
        return { n, count: names.length };
      });
      expect(overlaps.count).toBeGreaterThan(20);
      expect(overlaps.n).toBe(0);
    });
  }

  test('the timeline starts at 100 BC', async ({ page }) => {
    await loadPage(page);
    // Pan far to the left: the view stops at the floor.
    for (let i = 0; i < 6; i++) await page.locator('[title="Scroll left"]').dispatchEvent('mousedown');
    await page.locator('.timeline-container').evaluate(el => {
      for (let i = 0; i < 40; i++) el.dispatchEvent(new WheelEvent('wheel', { deltaX: -400, bubbles: true, cancelable: true }));
    });
    await expect(page.locator('.zoom-info')).toHaveText(/^100 BC/);
  });

  test("the detail panel's title takes focus without a ring", async ({ page }) => {
    await loadPage(page);
    await page.locator('.timeline-search-input').first().fill('Athanasius');
    await page.locator('.timeline-search-option', { hasText: 'Athanasius' }).first().click();
    const title = page.locator('#timeline-detail-title');
    await expect(title).toBeFocused();
    await expect(title).toHaveCSS('outline-style', 'none');
  });

  test('leaving the tour, the rest of the timeline sweeps in, then settles', async ({ page }) => {
    await loadPage(page, { dismissWelcome: false, realData: true });
    await page.getByRole('button', { name: 'Take the Tour' }).click();
    await expect(page.locator('[title="Exit tour"]')).toBeVisible();
    const during = await page.locator('.person-label').count();

    await page.locator('[title="Exit tour"]').click();
    // The newcomers arrive on a wave: their labels carry the reveal...
    await expect.poll(() => page.locator('.person-label[style*="timeline-reveal"]').count()).toBeGreaterThan(0);
    expect(await page.locator('.person-label').count()).toBeGreaterThan(during);
    // ...and within a couple of seconds the timeline is still again.
    await expect(page.locator('.person-label[style*="timeline-reveal"]')).toHaveCount(0, { timeout: 4000 });
    // The camera glided back to the opening view (round 3).
    await expect(page.locator('.zoom-info')).toHaveText('1–500 AD');
  });

  test('a trackpad pinch over the timeline zooms the timeline', async ({ page }) => {
    await loadPage(page);
    const before = await page.locator('.zoom-info').textContent();
    const prevented = await page.locator('.timeline-container').evaluate(el => {
      const r = el.getBoundingClientRect();
      const e = new WheelEvent('wheel', { deltaY: -400, ctrlKey: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true });
      el.dispatchEvent(e);
      return e.defaultPrevented;
    });
    expect(prevented).toBe(true);
    await expect(page.locator('.zoom-info')).not.toHaveText(before);
  });

  test('when the page itself is zoomed, the timeline lets the wheel scroll the page', async ({ page }) => {
    // Pinching over the header zooms the whole page; the timeline then held
    // every wheel, so the reader couldn't scroll back out to the header.
    await page.addInitScript(() => {
      Object.defineProperty(VisualViewport.prototype, 'scale', { get: () => 2, configurable: true });
    });
    await loadPage(page);
    const before = await page.locator('.zoom-info').textContent();
    const prevented = await page.locator('.timeline-container').evaluate(el => {
      const e = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true });
      el.dispatchEvent(e);
      return e.defaultPrevented;
    });
    expect(prevented).toBe(false);
    await expect(page.locator('.zoom-info')).toHaveText(before);
  });

  test('on a phone the tour is a bottom sheet, leaving the timeline the top', async ({ page }) => {
    await loadPage(page, { viewport: { width: 390, height: 844 }, mobile: true, dismissWelcome: false });
    await page.getByRole('button', { name: 'Take the Tour' }).click();
    const sheet = await page.locator('.tour-panel').boundingBox();
    expect(sheet.width).toBeGreaterThanOrEqual(388);
    expect(sheet.y + sheet.height).toBeGreaterThan(844 - 2);
    expect(sheet.height).toBeLessThanOrEqual(844 * 0.5);
    // The timeline keeps the full width above it.
    const timeline = await page.locator('.mobile-timeline').boundingBox();
    expect(timeline.width).toBeGreaterThanOrEqual(388);
    expect(timeline.y + timeline.height).toBeLessThanOrEqual(sheet.y + 1);
  });

  test('on a phone, each tour scene frames its figures in the vertical timeline', async ({ page }) => {
    // The tour's framing only drove the horizontal timeline, so on a phone
    // every scene stayed wherever the reader had last scrolled (round 5).
    await loadPage(page, { viewport: { width: 390, height: 844 }, mobile: true, dismissWelcome: false });
    await page.getByRole('button', { name: 'Take the Tour' }).click();
    await page.locator('[title="Next (→)"]').click();
    // Scene two: Athanasius and Gregory of Nyssa, whole, inside the visible
    // part of the timeline (above the tour sheet).
    await expect.poll(() => page.evaluate(() => {
      const view = document.querySelector('.mobile-timeline-scroll').getBoundingClientRect();
      const bar = (name) => [...document.querySelectorAll('.mobile-person-name')]
        .find(el => el.textContent === name)?.closest('.mobile-person-lane')?.getBoundingClientRect();
      return ['Athanasius', 'Gregory of Nyssa'].every(name => {
        const b = bar(name);
        return b && b.top >= view.top - 1 && b.bottom <= view.bottom + 1;
      });
    }), { timeout: 3000 }).toBe(true);
  });

  // Scene 7 of the real tour opens Irenaeus. On a phone the full dialog, map
  // and all, covered the timeline and half the tour sheet; it is now a short
  // card above the sheet (owner's call, round 6c).
  for (const layout of ['vertical', 'horizontal']) {
    test(`on a phone (${layout}), a tour step's figure opens as a short card above the sheet`, async ({ page }) => {
      await page.addInitScript(l => localStorage.setItem('lifelines-layout', l), layout);
      await loadPage(page, { viewport: { width: 390, height: 844 }, mobile: layout === 'vertical', dismissWelcome: false, realData: true });
      await page.getByRole('button', { name: 'Take the Tour' }).click();
      for (let i = 0; i < 6; i++) {
        await page.locator('[title="Next (→)"]').click();
        await page.waitForTimeout(150);
      }
      const card = page.locator('.timeline-modal--brief .modal-content');
      await expect(card.getByRole('heading', { name: 'Irenaeus of Lyons' })).toBeVisible({ timeout: 3000 });
      // No backdrop, map or works list; short, and clear of the tour sheet.
      await expect(page.locator('.modal-backdrop')).toHaveCount(0);
      await expect(page.locator('.historical-map-container')).toHaveCount(0);
      await expect(card.locator('.modal-works')).toHaveCount(0);
      const box = await card.boundingBox();
      const sheet = await page.locator('.tour-panel').boundingBox();
      expect(box.height).toBeLessThanOrEqual(844 * 0.45);
      expect(box.y + box.height).toBeLessThanOrEqual(sheet.y);
      // The tour carries on underneath it.
      await expect(page.locator('[title="Next (→)"]')).toBeEnabled();

      // "More" opens the full detail, map included.
      await card.getByRole('button', { name: 'More about Irenaeus of Lyons' }).click();
      await expect(page.locator('.timeline-modal--brief')).toHaveCount(0);
      await expect(page.locator('.historical-map-container')).toHaveCount(1, { timeout: 10_000 });
    });
  }

  test('on a phone, a figure tapped outside the tour still opens the full detail', async ({ page }) => {
    await loadPage(page, { viewport: { width: 390, height: 844 }, mobile: true });
    await page.locator('.mobile-person-name', { hasText: 'Athanasius' }).first().click();
    await expect(page.locator('.timeline-modal .modal-title')).toContainText('Athanasius');
    await expect(page.locator('.timeline-modal--brief')).toHaveCount(0);
    await expect(page.locator('.historical-map-container')).toHaveCount(1, { timeout: 10_000 });
  });

  test('the layout toggle switches between the two timelines and is remembered', async ({ page }) => {
    await loadPage(page);
    const toggle = page.getByRole('group', { name: 'Layout' });
    await expect(toggle.getByRole('button', { name: 'Horizontal' })).toHaveAttribute('aria-pressed', 'true');

    await toggle.getByRole('button', { name: 'Vertical' }).click();
    await expect(page.locator('.mobile-timeline')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'Vertical' }))
      .toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(page.locator('.mobile-timeline')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'Horizontal' }).click();
    await expect(page.locator('.mobile-timeline')).toHaveCount(0);
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('phones start vertical, with the layout toggle in the toolbar', async ({ page }) => {
    await loadPage(page, { viewport: { width: 390, height: 844 }, mobile: true });
    await expect(page.locator('.mobile-timeline-toolbar').getByRole('group', { name: 'Layout' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Vertical' })).toHaveAttribute('aria-pressed', 'true');
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

    // Athanasius's background is now in focus: the emperor reigning in his
    // lifetime is marked in the rulers' strip.
    await expect(page.locator('.ruler-strip-item.is-focus', { hasText: 'Constantius II' })).toBeVisible();

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

  test('on a phone, zooming in keeps the years on screen', async ({ page }) => {
    // Zooming kept the scroll offset in pixels, so zooming in slid the view
    // back towards 100 BC and empty years (M3 step 6).
    await loadPage(page, { viewport: { width: 390, height: 844 }, mobile: true, realData: true });
    const label = page.locator('.mobile-zoom-label');
    await expect(label).toHaveText(/AD/);
    const middle = (text) => {
      const years = [...text.matchAll(/(\d+)\s*(BC|AD)?/g)].map(m => (m[2] === 'BC' ? -Number(m[1]) : Number(m[1])));
      // "5 BC – 85 AD", or "100–150 AD" with one era for both.
      if (/BC/.test(text) && !/AD/.test(text)) years.forEach((y, i) => { years[i] = -Math.abs(y); });
      return (years[0] + years[years.length - 1]) / 2;
    };
    const before = middle(await label.textContent());
    const zoomIn = page.locator('.mobile-zoom-controls .mobile-toolbar-btn').nth(1);
    await zoomIn.click();
    await zoomIn.click();
    await expect(label).not.toHaveText(/BC/);
    expect(Math.abs(middle(await label.textContent()) - before)).toBeLessThanOrEqual(8);
  });

  test('on a phone, landmarks are strings whose labels sit beside the axis, clear of figures and each other', async ({ page }) => {
    await loadPage(page, { viewport: { width: 390, height: 844 }, mobile: true, realData: true });
    // The old cards sat on the bars and on one another (DESIGN §7 known
    // violation, M3 step 6).
    await expect(page.locator('.mobile-point-marker')).toHaveCount(0);
    expect(await page.locator('.mobile-string-mark').count()).toBeGreaterThan(50);
    const clashes = await page.evaluate(() => {
      const rects = (sel) => [...document.querySelectorAll(sel)].map(el => el.getBoundingClientRect());
      const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
      const labels = rects('.mobile-string-name');
      const bars = rects('.mobile-person-lane');
      let found = 0;
      labels.forEach((l, i) => {
        if (bars.some(b => hit(l, b))) found++;
        if (labels.slice(i + 1).some(o => hit(l, o))) found++;
      });
      return { found, labels: labels.length };
    });
    expect(clashes.labels).toBeGreaterThan(3);
    expect(clashes.found).toBe(0);
    // Tapping a mark opens the landmark.
    await page.locator('.mobile-string-mark').first().click();
    await expect(page.locator('.timeline-modal .modal-title')).toBeVisible();
  });

  test('on a phone, the vertical timeline keeps the rulers, in a column at the right edge', async ({ page }) => {
    // The vertical layout dropped every emperor and monarch while the Key
    // still offered their switch (Codex review on PR #160). They now sit in
    // the bottom strip's vertical twin.
    await loadPage(page, { viewport: { width: 390, height: 844 }, mobile: true, realData: true });
    const column = page.locator('.mobile-ruler-column');
    await expect(column).toBeVisible();
    const box = await column.boundingBox();
    expect(box.x + box.width).toBeGreaterThan(388);
    const tiberius = column.getByRole('button', { name: /^Tiberius,/ });
    await expect(tiberius).toBeVisible();

    // It scrolls with the years: Tiberius moves as far as the 25 AD gridline.
    const yOf = () => tiberius.evaluate(el => el.getBoundingClientRect().top);
    const before = await yOf();
    await page.locator('.mobile-timeline-scroll').evaluate(el => { el.scrollTop += 200; });
    await expect.poll(yOf).toBeCloseTo(before - 200, 0);

    // Names never overlap one another.
    const clashes = await column.evaluate(el => {
      const r = [...el.querySelectorAll('.mobile-ruler-name')].map(n => n.getBoundingClientRect());
      let n = 0;
      r.forEach((a, i) => r.slice(i + 1).forEach(b => {
        if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) n++;
      }));
      return n;
    });
    expect(clashes).toBe(0);

    // A tap opens the ruler; the Key's switch hides the column.
    await tiberius.click();
    await expect(page.locator('.timeline-modal .modal-title')).toContainText('Tiberius');
    await page.locator('.timeline-modal .modal-close').click();
    await page.locator('.mobile-toolbar-btn', { hasText: 'Filter' }).click();
    await page.locator('.mobile-filter-item', { hasText: 'Emperors' }).locator('input').uncheck();
    await expect(column).toHaveCount(0);
  });

  test('on a phone, the vertical timeline is on white: toolbar and year gutter', async ({ page }) => {
    await loadPage(page, { viewport: { width: 390, height: 844 }, mobile: true });
    const bg = (sel) => page.locator(sel).evaluate(el => getComputedStyle(el).backgroundColor);
    const channels = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
    expect(Math.min(...channels(await bg('.mobile-timeline-toolbar')))).toBeGreaterThanOrEqual(250);
    expect(Math.min(...channels(await bg('.mobile-year-gutter')))).toBeGreaterThanOrEqual(250);
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

  test('no figure label runs into the next one in its row (real data)', async ({ page }) => {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 820, height: 1180 }]) {
      await loadPage(page, { viewport, realData: true });
      const boxes = await page.locator('.person-label').evaluateAll(els => els.map(el => {
        const r = el.getBoundingClientRect();
        return { text: el.textContent, top: Math.round(r.top), left: r.left, right: r.right };
      }));
      expect(boxes.length).toBeGreaterThan(20);
      const overlaps = [];
      // Grouped by hand: CI runs Node 20, which has no Map.groupBy.
      const rows = new Map();
      for (const b of boxes) rows.set(b.top, [...(rows.get(b.top) || []), b]);
      for (const row of rows.values()) {
        row.sort((a, b) => a.left - b.left);
        for (let i = 1; i < row.length; i++) {
          if (row[i].left < row[i - 1].right - 1) overlaps.push(`${row[i - 1].text} / ${row[i].text}`);
        }
      }
      expect(overlaps, `at ${viewport.width}px`).toEqual([]);
    }
  });

  test('search names results as the legend does, without the red EVENT chip', async ({ page }) => {
    await loadPage(page);
    const search = page.locator('.timeline-search-input').first();
    await search.fill('Nicaea');
    const council = page.locator('.timeline-search-dropdown [role="option"]', { hasText: 'Council of Nicaea' });
    await expect(council.locator('.timeline-search-option-kind')).toHaveText('Council');
    await search.fill('Athanasius');
    await expect(page.locator('.timeline-search-option-kind').first()).toHaveText('Person');
    await expect(page.locator('.timeline-search-option-type')).toHaveCount(0);
  });

  test('the detail panel leads with the description and a sentence-case map heading', async ({ page }) => {
    await loadPage(page);
    await page.locator('.timeline-search-input').first().fill('Athanasius');
    await page.locator('.timeline-search-dropdown [role="option"]').first().click();
    const panel = page.locator('.timeline-modal--panel');
    await expect(panel.locator('.historical-map-section h3')).toHaveText('Historical map');
    // boundingBox() doesn't wait; under a busy parallel run the description
    // could still be mounting when it was measured.
    await expect(panel.locator('.modal-description')).toBeVisible();
    const descY = (await panel.locator('.modal-description').boundingBox()).y;
    // The map loads on first use (LazyMaps): its placeholder is swapped for
    // the real section, so wait for that before measuring it.
    await expect(panel.locator('.historical-map-container:not([aria-busy])')).toBeAttached();
    const mapY = (await panel.locator('.historical-map-section').boundingBox()).y;
    expect(descY).toBeLessThan(mapY);
  });

  test('keyboard route: skip link, search, panel, Esc back to search', async ({ page }) => {
    await loadPage(page, { dismissWelcome: false });
    // The welcome dialog takes focus on its main button; Tab, Enter skips it.
    const welcome = page.getByRole('dialog', { name: 'Welcome to Lifelines' });
    await expect(welcome.getByRole('button', { name: 'Take the Tour' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(welcome.getByRole('button', { name: 'Skip' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(welcome).toHaveCount(0);

    // Focus starts again at the top: the skip link, shown because the
    // keyboard put it there.
    const skip = page.getByRole('link', { name: 'Skip to search' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    const search = page.getByLabel('Search figures, councils and texts');
    await expect(search).toBeFocused();

    // Pick a figure from the results without the mouse.
    await page.keyboard.type('Athanasius');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    const panel = page.getByRole('region', { name: 'Athanasius' });
    await expect(panel).toBeVisible();
    await expect(page.locator('#timeline-detail-title')).toBeFocused();

    // Esc closes it and hands focus back to search.
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(search).toBeFocused();
  });

  // Harp strings are Lifelines' landmarks (owner's pick, M3 round 2).
  test('landmarks are harp strings, and a label click opens its landmark', async ({ page }) => {
    // Also guards the mouseup fix: a click with no settled move before it
    // read as a drag and was swallowed, so landmarks opened nothing.
    await loadPage(page);
    await expect(page.locator('.point-callout')).toHaveCount(0);
    // Strings rest on the canvas (round 3); their hit strips are the sign.
    expect(await page.locator('.point-string-hit').count()).toBeGreaterThan(0);
    await page.locator('.point-string-label', { hasText: 'Council of Nicaea' }).click();
    await expect(page.locator('.timeline-modal--panel .modal-title')).toContainText('Council of Nicaea');
  });

  // Round 3 tried short labels that grew on hover; round 4 took them back
  // (owner's call): a label reads the same at rest and under the pointer.
  test('labels show the full name and do not change on hover; marks follow the kind', async ({ page }) => {
    await loadPage(page);
    const label = page.locator('.point-string-label', { hasText: 'Council of Nicaea' });
    await expect(label).toHaveText('Council of Nicaea');
    await label.hover();
    await expect(label).toHaveText('Council of Nicaea');
    // A council's mark is a diamond, in the label and on its dots.
    await expect(label.locator('.string-mark--diamond')).toHaveCount(1);
    await expect(page.locator('.point-string-dot--diamond[data-point-id="council-nicaea"]').first()).toBeAttached();
    // The Key shows the same marks.
    await expect(page.locator('.legend-slim-rows .string-mark--diamond')).toHaveCount(1);
    await expect(page.locator('.legend-slim-rows .string-mark--square')).toHaveCount(1);
  });

  test('major events show with a dot; minor events and councils are hidden', async ({ page }) => {
    await loadPage(page);
    const fire = page.locator('.point-string-label', { hasText: 'Great Fire of Rome' });
    await expect(fire).toBeVisible();
    await expect(fire.locator('.string-mark--dot')).toHaveCount(1);
    await expect(page.locator('.point-string-label', { hasText: 'Hagia Sophia' })).toHaveCount(0);
    await expect(page.locator('.point-string-label', { hasText: 'Council of Arles' })).toHaveCount(0);
    // Minor landmarks aren't searchable either.
    await page.locator('.timeline-search-input').first().fill('Arles');
    await expect(page.locator('.timeline-search-option', { hasText: 'Council of Arles' })).toHaveCount(0);
    await page.locator('.timeline-search-input').first().fill('');
    // The Key's Events row switches them.
    await page.getByRole('checkbox', { name: 'Events' }).click();
    await expect(fire).toHaveCount(0);
  });

  test('hovering a string lights up the people linked to it', async ({ page }) => {
    await loadPage(page);
    const hit = page.locator('.point-string-hit[data-point-id="council-nicaea"]').last();
    await hit.hover();
    const line = page.locator('.point-string[data-point-id="council-nicaea"]');
    await expect(line).toHaveCSS('width', '3px');
    await expect(line).toHaveCSS('background-color', 'rgb(227, 169, 43)');
    const rings = page.locator('.point-string-person-ring');
    await expect(rings).toHaveCount(2);
    expect((await rings.evaluateAll(els => els.map(e => e.dataset.personId))).sort()).toEqual(['athanasius', 'eusebius']);
    await page.mouse.move(5, 5);
    await expect(rings).toHaveCount(0);
  });

  test('strings rest behind the figures; the hovered one comes to the front', async ({ page }) => {
    await loadPage(page);
    // At rest, no string is drawn over the page: they are on the canvas,
    // under the bars.
    await expect(page.locator('.point-string')).toHaveCount(0);
    await page.locator('.point-string-hit[data-point-id="council-nicaea"]').last().hover();
    const line = page.locator('.point-string[data-point-id="council-nicaea"]');
    await expect(line).toHaveCount(1);
    // Over the names: it stacks above the figure labels.
    const z = await line.evaluate(el => Number(getComputedStyle(el).zIndex));
    const labelZ = await page.locator('.person-label').first().evaluate(el => Number(getComputedStyle(el).zIndex));
    expect(z).toBeGreaterThan(labelZ);
  });

  test('a string turns gold under the pointer, and clicking it opens the landmark', async ({ page }) => {
    await loadPage(page);
    const line = page.locator('.point-string[data-point-id="council-nicaea"]');
    await page.locator('.point-string-hit[data-point-id="council-nicaea"]').last().hover();
    await expect(line).toHaveClass(/is-hover/);
    await expect(line).toHaveCSS('background-color', 'rgb(227, 169, 43)');
    await page.locator('.point-string-hit[data-point-id="council-nicaea"]').last().click();
    await expect(page.locator('.timeline-modal--panel .modal-title')).toContainText('Council of Nicaea');
  });

  test("a linked landmark has a dot on each of its figures' bars", async ({ page }) => {
    await loadPage(page);
    // The fixture links Nicaea to Athanasius and Eusebius (CH_EventConnections).
    const dots = page.locator('.point-string-dot[data-point-id="council-nicaea"]');
    await expect(dots).toHaveCount(2);
    expect((await dots.evaluateAll(els => els.map(e => e.dataset.personId))).sort()).toEqual(['athanasius', 'eusebius']);
    const dot = page.locator('.point-string-dot[data-point-id="council-nicaea"][data-person-id="athanasius"]');
    const d = await dot.boundingBox();
    const label = await page.locator('.timeline-overlay').getByText('Athanasius', { exact: true }).first().boundingBox();
    // On the bar's lower edge: just under the name, not on the axis.
    const dotY = d.y + d.height / 2;
    expect(dotY).toBeGreaterThan(label.y);
    expect(dotY).toBeLessThan(label.y + label.height + 12);
  });

  test('on real data, no unlinked dot covers a figure', async ({ page }) => {
    await loadPage(page, { realData: true });
    const overlaps = await page.evaluate(() => {
      const names = [...document.querySelectorAll('.timeline-overlay .person-label')]
        .map(el => el.getBoundingClientRect());
      return [...document.querySelectorAll('.point-string-dot:not(.is-linked)')].filter(dot => {
        const r = dot.getBoundingClientRect();
        return names.some(n => r.left < n.right && r.right > n.left && r.top < n.bottom && r.bottom > n.top);
      }).map(d => d.dataset.pointId);
    });
    expect(overlaps).toEqual([]);
    expect(await page.locator('.point-string-dot.is-linked').count()).toBeGreaterThan(5);
  });

  test('a click on empty timeline opens that year; a click on the controls does not', async ({ page }) => {
    await loadPage(page);
    // Controls and the legend are not empty timeline: no year summary.
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('checkbox', { name: 'Councils' }).click();
    await page.getByRole('checkbox', { name: 'Councils' }).click();
    await expect(page.getByRole('heading', { level: 2 }).filter({ hasText: /\d+ (AD|BC)/ })).toHaveCount(0);

    // Empty canvas, low on the page and clear of the lanes, is.
    const box = await page.locator('.timeline-container').boundingBox();
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.85);
    await expect(page.getByRole('heading', { level: 2 }).filter({ hasText: /\d+ (AD|BC)/ })).toBeVisible();
  });
});


// Milestone 3, step 9: the desktop's horizontal timeline on a phone, chosen
// with the layout toggle (remembered under lifelines-layout).
// The timeline had no touch handling at all, so these drive real touch
// events through the DevTools protocol (Chromium only, like the suite).
test.describe('Horizontal phone prototype (milestone 3)', () => {
  test.use({ hasTouch: true, isMobile: true });
  const PHONE = { viewport: { width: 390, height: 844 }, realData: true };

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lifelines-layout', 'horizontal'));
    const built = path.join(REPO_ROOT, 'apps/church-history-2.html');
    test.skip(!fs.existsSync(built), 'apps/ not built — run `npm run build` first');
  });

  async function touch(page) {
    const cdp = await page.context().newCDPSession(page);
    const send = (type, points) => cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: points.map(([x, y], id) => ({ x, y, id })),
    });
    return {
      async drag(from, to, steps = 8) {
        await send('touchStart', [from]);
        for (let i = 1; i <= steps; i++) {
          await send('touchMove', [[from[0] + (to[0] - from[0]) * i / steps, from[1] + (to[1] - from[1]) * i / steps]]);
        }
        await send('touchEnd', []);
      },
      async pinch(center, fromGap, toGap, steps = 8) {
        const at = (gap) => [[center[0] - gap / 2, center[1]], [center[0] + gap / 2, center[1]]];
        await send('touchStart', at(fromGap));
        for (let i = 1; i <= steps; i++) await send('touchMove', at(fromGap + (toGap - fromGap) * i / steps));
        await send('touchEnd', []);
      },
    };
  }

  // "30–130 AD" → [30, 130]; good enough for AD-only spans.
  async function span(page) {
    const text = await page.locator('.zoom-info').textContent();
    const [a, b] = text.replace(/\s*AD$/, '').split('–').map(Number);
    return [a, b];
  }

  test('a phone gets the horizontal timeline, opening on the apostolic age', async ({ page }) => {
    await loadPage(page, PHONE);
    await expect(page.locator('.mobile-timeline')).toHaveCount(0);
    await expect(page.locator('.zoom-info')).toHaveText('1–160 AD');
    // Touch-sized zoom buttons, still named for a screen reader.
    const zoomIn = page.getByRole('button', { name: 'Zoom in' });
    const box = await zoomIn.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test('a finger drag pans the timeline', async ({ page }) => {
    await loadPage(page, PHONE);
    const [start] = await span(page);
    const t = await touch(page);
    // Mid-timeline: the foot of the screen holds the rulers' strip and,
    // above it, the controls, which keep their own touch.
    await t.drag([300, 500], [100, 500]);
    // Dragging leftwards brings later years into view.
    await expect.poll(async () => (await span(page))[0]).toBeGreaterThan(start + 20);
    // A drag is not a tap: no year summary or detail opens.
    await expect(page.locator('.timeline-modal')).toHaveCount(0);
    // And it leaves no hover trail behind (a phone has no hover).
    await expect(page.locator('.cursor-year-line')).toHaveCount(0);
  });

  test('a tap on a figure opens its detail as a modal', async ({ page }) => {
    await loadPage(page, PHONE);
    // Tap the bar just right of Polycarp's label (the label sits on the bar).
    const label = await page.locator('.timeline-overlay').getByText('Polycarp', { exact: true }).first().boundingBox();
    await page.touchscreen.tap(label.x + label.width + 30, label.y + label.height / 2);
    await expect(page.locator('.timeline-modal')).toBeVisible();
    await expect(page.locator('.timeline-modal--panel')).toHaveCount(0);
    await expect(page.locator('#timeline-detail-title')).toHaveText(/Polycarp/);
  });

  test('a pinch zooms about the fingers', async ({ page }) => {
    await loadPage(page, PHONE);
    const [a0, b0] = await span(page);
    const t = await touch(page);
    await t.pinch([195, 500], 80, 240);
    // Spreading the fingers threefold shows about a third as many years.
    await expect.poll(async () => { const [a, b] = await span(page); return b - a; })
      .toBeLessThan((b0 - a0) / 2);
  });
});
