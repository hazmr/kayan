import { testEnv } from '../support/env'
import { removeUploads } from '../support/prepareDatabase'

import { E2E_DATABASE, E2E_PORT } from './global-setup'

// After the browser test: remove the receipt and image files it uploaded.
export default function globalTeardown(): void {
  removeUploads(testEnv(E2E_DATABASE, `http://localhost:${E2E_PORT}`))
}
