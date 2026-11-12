import { defineConfig } from '@playwright/test'

import { E2E_DATABASE, E2E_PORT } from './tests/e2e/global-setup'
import { testEnv } from './tests/support/env'

const siteUrl = `http://localhost:${E2E_PORT}`

// The browser test: one purchase from start to finish, in a real browser.
//
// It builds the app and runs it on its own port against its own throwaway database, so it never
// touches the development server or the development data.
//
// Browser: by default Playwright's own Chromium (`pnpm exec playwright install chromium`).
// To use one you already have, set E2E_BROWSER_PATH, for example E2E_BROWSER_PATH=/usr/bin/brave
export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: siteUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath: process.env.E2E_BROWSER_PATH || undefined },
  },
  webServer: {
    command: 'pnpm build && pnpm start -p ' + E2E_PORT,
    url: `${siteUrl}/en/login`,
    env: testEnv(E2E_DATABASE, siteUrl),
    timeout: 300_000,
    reuseExistingServer: false,
    stdout: 'ignore',
  },
})
