import path from 'node:path'

import { defineConfig } from 'vitest/config'

import { testEnv } from './tests/support/env.ts'

// Two groups of tests:
//   unit         plain functions, no database, runs in a second
//   integration  the real app code against a throwaway Postgres database
// The browser test (Playwright) has its own config: playwright.config.ts.
export default defineConfig({
  resolve: {
    alias: [
      // Same shortcuts as tsconfig.json
      { find: '@payload-config', replacement: path.resolve('src/payload.config.ts') },
      { find: /^@\//, replacement: `${path.resolve('src')}/` },
    ],
  },
  test: {
    env: testEnv('kayan_test'),
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['tests/unit/**/*.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['tests/support/globalSetup.ts'],
          // One database, so one file at a time. Each file makes its own users and courses.
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
})
