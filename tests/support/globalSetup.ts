import { testEnv } from './env'
import { prepareDatabase, removeUploads } from './prepareDatabase'

export const INTEGRATION_DATABASE = 'vetudy_test'

// Runs once before the integration tests (and once after): a fresh database, then cleanup.
export function setup(): void {
  prepareDatabase(INTEGRATION_DATABASE, testEnv(INTEGRATION_DATABASE))
}

export function teardown(): void {
  removeUploads(testEnv(INTEGRATION_DATABASE))
}
