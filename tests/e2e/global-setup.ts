import { execFileSync } from 'node:child_process'

import { testEnv } from '../support/env'
import { prepareDatabase } from '../support/prepareDatabase'

export const E2E_DATABASE = 'kayan_e2e'
export const E2E_PORT = 3100

// Before the browser test: a fresh database (built from the real migrations) and its seed data.
export default function globalSetup(): void {
  const env = testEnv(E2E_DATABASE, `http://localhost:${E2E_PORT}`)
  prepareDatabase(E2E_DATABASE, env)
  execFileSync('pnpm', ['payload', 'run', 'tests/support/seedE2E.ts'], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}
