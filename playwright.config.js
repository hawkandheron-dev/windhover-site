import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    // A sandbox with a preinstalled browser (Claude's cloud sessions) points
    // this at it instead of running `playwright install`. Unset in CI.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
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
