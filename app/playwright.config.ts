// The full end-to-end test (task T25): one member's journey from joining to
// reporting, against a local Supabase (npx supabase start). It needs these
// settings, which `npx supabase status -o env` prints:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, MAILPIT_URL
// Run with: npm run e2e
import { defineConfig, devices } from '@playwright/test'

const port = 5174

export default defineConfig({
  testDir: 'e2e',
  timeout: 600_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    locale: 'en-GB',
    // One stuck step fails fast instead of using up the whole run.
    actionTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Cloud machines without Playwright's own browsers can point at another Chromium.
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [{ name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } }],
  webServer: {
    command: `npx vite --port ${port} --strictPort`,
    port,
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? '',
    },
  },
})
