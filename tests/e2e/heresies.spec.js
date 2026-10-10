/**
 * Smoke coverage for the Heresies & Christological Controversies timeline.
 *
 * The dataset is a deliberately tiny stand-in for the real CH_ tables — one
 * figure per doctrinal role, one council, one movement — which is enough to
 * exercise the adapter's scoping rules, the role-driven colouring, the
 * config-driven legend and the filter toggles.
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
  era_id: 'era-ante-nicene',
  is_monarch: false,
  monarch_type: null,
  doctrinal_role: role,
  description: `${name} — test fixture.`,
  reference_url: 'https://example.invalid/',
  ...extra,
});

const TABLES = {
  CH_People: [
    person('athanasius', 'Athanasius', 296, 373, 'defender'),
    person('pope-leo-1', 'Pope Leo I', 400, 461, 'defender'),
    person('arius', 'Arius', 256, 336, 'heresiarch'),
    person('origen', 'Origen', 185, 254, 'contested'),
    person('unclassified-figure', 'Unclassified Figure', 300, 360, null),
    person('roman-constantine', 'Constantine', 272, 337, 'emperor-christian', {
      role_type: 'emperor',
      is_monarch: true,
      monarch_type: 'roman-unified',
      era_id: null,
      reign_start_year: 306,
      reign_end_year: 337,
    }),
    person('roman-nero', 'Nero', 37, 68, 'emperor-pagan', {
      role_type: 'emperor',
      is_monarch: true,
      monarch_type: 'roman-unified',
      era_id: null,
      reign_start_year: 54,
      reign_end_year: 68,
    }),
    // Out of the monarch window and unclassified: must not appear.
    person('later-monarch', 'Later Monarch', 900, 950, null, {
      role_type: 'emperor',
      is_monarch: true,
      era_id: null,
      reign_start_year: 920,
      reign_end_year: 950,
    }),
  ],
  CH_Events: [
    {
      event_id: 'council-nicaea', name: 'Council of Nicaea', event_type: 'council',
      event_date: '0325-01-01', end_date: null, location: 'Nicaea',
      description: 'Test fixture.', reference_url: 'https://example.invalid/',
    },
    {
      event_id: 'doc-nicene-creed', name: 'The Nicene Creed', event_type: 'document',
      event_date: '0325-01-01', end_date: null, location: 'Nicaea',
      description: 'Test fixture.', reference_url: 'https://example.invalid/',
    },
    // Not linked to a movement and not an ecumenical council: must be excluded.
    {
      event_id: 'doc-unrelated', name: 'Unrelated Document', event_type: 'document',
      event_date: '0700-01-01', end_date: null, location: 'Nowhere',
      description: 'Test fixture.', reference_url: null,
    },
  ],
  CH_Movements: [
    {
      movement_id: 'mov-arianism', name: 'Arianism', kind: 'heresy',
      start_year: 318, end_year: 381, color: '#c62828',
      description: 'Test fixture.', reference_url: 'https://example.invalid/',
    },
    {
      movement_id: 'mov-origenism', name: 'The Origenist Controversy', kind: 'controversy',
      start_year: 393, end_year: 451, color: '#558b2f',
      description: 'Test fixture.', reference_url: 'https://example.invalid/',
    },
  ],
  CH_Movement_Figures: [
    { id: 1, movement_id: 'mov-arianism', person_id: 'arius', role: 'founder' },
    { id: 2, movement_id: 'mov-arianism', person_id: 'athanasius', role: 'opponent' },
    { id: 3, movement_id: 'mov-origenism', person_id: 'origen', role: 'associated' },
  ],
  CH_Movement_Events: [
    { id: 1, movement_id: 'mov-arianism', event_id: 'council-nicaea', relation: 'condemned_at' },
    { id: 2, movement_id: 'mov-arianism', event_id: 'doc-nicene-creed', relation: 'defined_at' },
  ],
  CH_Connections: [
    { connection_id: 1, person_id_1: 'athanasius', person_id_2: 'arius', connection_type: 'opposed' },
  ],
  CH_EventConnections: [
    { id: 1, event_id: 'council-nicaea', person_id: 'arius' },
  ],
  CH_Sources: [],
  CH_Source_Figures: [],
  CH_Works: [],
};

async function loadPage(page) {
  await installConfigMock(page, { clerkKey: '' });
  await installClerkMock(page);
  await installSupabaseTableMock(page, TABLES);
  await page.setViewportSize({ width: 1400, height: 900 });
  const response = await page.goto('/apps/heresies.html');
  expect(response?.status()).toBe(200);
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 });
}

test.describe('Heresies timeline', () => {
  test.beforeEach(() => {
    const built = path.join(REPO_ROOT, 'apps/heresies.html');
    test.skip(!fs.existsSync(built), 'apps/ not built — run `npm run build` first');
  });

  test('renders with the doctrinal legend and no error banner', async ({ page }) => {
    await loadPage(page);

    await expect(page.locator('.legend-site-title')).toContainText('Heresies');
    await expect(page.getByText(/^Error:/)).toHaveCount(0);

    for (const label of [
      'Defenders of orthodoxy',
      'Heresiarchs',
      'Contested figures',
      'Other church figures',
      'Emperors',
      'Councils & synods',
      'Creeds & documents',
      'Heresies & schisms',
      'Controversies & schools',
    ]) {
      await expect(page.locator('.legend-item', { hasText: label }).first()).toBeVisible();
    }
  });

  test('keeps its zoom and pan buttons (Lifelines dropped its own)', async ({ page }) => {
    await loadPage(page);
    await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
    await expect(page.locator('.compass-rose')).toBeVisible();
  });

  test('search finds scoped figures and movements but not excluded rows', async ({ page }) => {
    await loadPage(page);

    const search = page.locator('.timeline-search input').first();

    await search.fill('Arius');
    await expect(page.locator('.timeline-search-option', { hasText: 'Arius' }).first()).toBeVisible();

    // Movements are on the timeline as periods
    await search.fill('Arianism');
    await expect(page.locator('.timeline-search-option', { hasText: 'Arianism' }).first()).toBeVisible();

    // Excluded by the adapter's scoping rules
    await search.fill('Unrelated Document');
    await expect(page.locator('.timeline-search-option')).toHaveCount(0);

    await search.fill('Later Monarch');
    await expect(page.locator('.timeline-search-option')).toHaveCount(0);
  });

  test('mobile marks chain members with their position in the succession', async ({ page }) => {
    await installConfigMock(page, { clerkKey: '' });
    await installClerkMock(page);
    await installSupabaseTableMock(page, TABLES);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/apps/heresies.html');

    // The mobile layout is a DOM swimlane, not a canvas, so the desktop
    // chain line can't be drawn; members carry their ordinal instead.
    const badges = page.locator('.mobile-chain-badge');
    await expect(badges.first()).toBeVisible({ timeout: 15_000 });

    // Of the eight NICENE_LINE ids, this fixture contains Athanasius (2nd)
    // and Leo (8th).
    await expect(badges).toHaveCount(2);
    expect((await badges.allTextContents()).sort()).toEqual(['2/8', '8/8']);
  });

  test('legend checkboxes filter the canvas', async ({ page }) => {
    await loadPage(page);
    await page.waitForTimeout(500);

    const canvas = page.locator('canvas').first();
    const before = await canvas.screenshot();

    const heresiarchs = page.locator('.legend-item', { hasText: 'Heresiarchs' }).first();
    await heresiarchs.click();
    await page.waitForTimeout(400);

    const after = await canvas.screenshot();
    expect(Buffer.compare(before, after)).not.toBe(0);

    // Toggling back brings them into view again
    await heresiarchs.click();
    await page.waitForTimeout(400);
    const restored = await canvas.screenshot();
    expect(Buffer.compare(after, restored)).not.toBe(0);
  });
});
