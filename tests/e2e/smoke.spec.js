/**
 * E2E smoke tests for the auth bootstrap path and build outputs.
 *
 * Scope is deliberately small: home-page (/home.html) Sign In behaviours, the
 * landing-nav build-output checks, and a basic CH Timeline page-load
 * check. Deep behavioural tests of the timeline app belong in a
 * follow-up PR with React Testing Library.
 *
 * All external dependencies are mocked via page.route() — no live
 * network, no shared state. See tests/e2e/fixtures.js for the
 * mock implementations.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  installAllMocks,
  installConfigMock,
  installSupabaseMock,
  installClerkMock,
  TEST_CLERK_KEY,
} from './fixtures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

// The old landing page moved to /home.html when Lifelines became the front
// page (see _redirects); its auth bootstrap is unchanged and still tested.
test.describe('home page auth bootstrap', () => {
  test('renders the Sign In button when config and Clerk are healthy', async ({ page }) => {
    await installAllMocks(page, {});
    await page.goto('/home.html');
    const signInBtn = page.locator('#ec-sign-in-btn');
    await expect(signInBtn).toBeVisible();
    await expect(signInBtn).toContainText(/Sign In|Sign Up/);
    await expect(signInBtn).toBeEnabled();
  });

  test('shows disabled "Sign-in unavailable" when CLERK_PUBLISHABLE_KEY is empty', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await installConfigMock(page, { clerkKey: '' });
    await installSupabaseMock(page);
    // Intentionally no Clerk mock — it must not be requested.
    let clerkRequested = false;
    await page.route('**/clerk*.js', (route) => {
      clerkRequested = true;
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    });

    await page.goto('/home.html');
    const btn = page.locator('#ec-sign-in-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('Sign-in unavailable');
    await expect(btn).toBeDisabled();
    expect(clerkRequested).toBe(false);
    expect(consoleErrors.join(' ')).toMatch(/CLERK_PUBLISHABLE_KEY missing/);
  });

  // Regression for the parallel-init hardening: a slow CMS query must not
  // block the auth UI from appearing. The "minutes-long load" symptom that
  // started this work would have been instantly debuggable if this test
  // had been in place.
  test('mounts auth UI within 1s even when the Supabase content fetch is slow', async ({ page }) => {
    await installConfigMock(page, {});
    await installClerkMock(page);
    // Delay the Supabase site_content query by 5s.
    await page.route('**/rest/v1/site_content**', async (route) => {
      await new Promise((r) => setTimeout(r, 5000));
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    const start = Date.now();
    await page.goto('/home.html');
    await expect(page.locator('#ec-sign-in-btn')).toBeVisible({ timeout: 1500 });
    expect(Date.now() - start).toBeLessThan(2000);
  });
});

test.describe('build outputs', () => {
  // Reads the old landing page (now home.html), extracts every landing-nav
  // href that points into apps/, and asserts the file exists on disk. This is
  // the build-check expressed as a test: a renamed/missing Vite entry fails CI.
  test('every apps/* landing-nav target exists in the built site', () => {
    const indexHtml = fs.readFileSync(path.join(REPO_ROOT, 'home.html'), 'utf-8');
    const hrefs = [...indexHtml.matchAll(/href="(apps\/[^"]+\.html)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    const missing = hrefs.filter((h) => !fs.existsSync(path.join(REPO_ROOT, h)));
    expect(missing, `Missing build outputs: ${missing.join(', ')}`).toEqual([]);
  });
});

test.describe('CH Timeline page', () => {
  test('responds 200 and mounts a non-empty React root', async ({ page }) => {
    const built = path.join(REPO_ROOT, 'apps/church-history-timeline.html');
    test.skip(!fs.existsSync(built), 'apps/ not built — run `npm run build` first');

    await installAllMocks(page, {});
    const response = await page.goto('/apps/church-history-timeline.html');
    expect(response?.status()).toBe(200);
    // React renders into #root; once mounted the div should have children.
    await expect(page.locator('#root > *')).toHaveCount(1, { timeout: 10_000 });
  });
});
