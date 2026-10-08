import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // On CI also write the HTML report, which the workflow uploads when a job fails.
  reporter: process.env.CI ? [['github'], ['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    // A sandbox with a preinstalled browser (Claude's cloud sessions) points
    // this at it instead of running `playwright install`. Unset in CI.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Firefox and WebKit (Safari's engine) run the Lifelines spec in their own
    // CI job (PW_ALL_BROWSERS=1). Off by default: the cloud sandbox has only
    // Chromium, and `npm run test:e2e` should not ask for browsers it lacks.
    ...(process.env.PW_ALL_BROWSERS ? [
      // Firefox has no phone emulation in Playwright (no isMobile), so it leaves
      // out the @phone block; Chromium and WebKit run it. Headless Firefox in
      // CI has no WebGL either, so its maps show the "can't be shown" fallback
      // (tested on its own) and the @webgl tests, which watch a map move, run
      // in Chromium and WebKit only.
      { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testMatch: /church-history-2\.spec\.js/, grepInvert: /@phone|@webgl/ },
      { name: 'webkit', use: { ...devices['Desktop Safari'] }, testMatch: /church-history-2\.spec\.js/ },
    ] : []),
  ],
  webServer: {
    // Serve the repo root so both the static pages (index.html, about.html,
    // pantheons-supabase.html) and the built apps/ directory are reachable.
    command: `npx serve -l ${PORT} -L .`,
    url: `http://localhost:${PORT}/`,
    timeout: 30_000,
    reuseExistingServer: !process.env.CI,
  },
});
