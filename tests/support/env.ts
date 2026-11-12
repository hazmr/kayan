import os from 'node:os'
import path from 'node:path'

/**
 * The settings every test run uses. They point at a THROWAWAY database and upload folder,
 * never at the development data, and use a secret that exists only here.
 *
 * Postgres must be running (pnpm services:up). Override the server with TEST_DATABASE_URL_BASE,
 * for example in CI: postgresql://user:password@localhost:5432
 */
export const DATABASE_SERVER =
  process.env.TEST_DATABASE_URL_BASE ?? 'postgresql://vetudy:vetudy@127.0.0.1:5433'

/** Only lowercase letters, digits, and underscores: the name is placed into SQL. */
const SAFE_NAME = /^[a-z0-9_]+$/

export function testEnv(
  databaseName: string,
  siteUrl = 'http://localhost:3000',
): Record<string, string> {
  if (!SAFE_NAME.test(databaseName)) throw new Error(`Unsafe test database name: ${databaseName}`)
  return {
    DATABASE_URL: `${DATABASE_SERVER}/${databaseName}`,
    PAYLOAD_SECRET: 'test-secret-that-is-only-used-by-the-test-suite-0123456789',
    NEXT_PUBLIC_SITE_URL: siteUrl,
    // Mailpit from docker-compose. Integration tests replace sending with a spy; the browser
    // test uses it for real, so its emails land in the development inbox.
    SMTP_HOST: process.env.TEST_SMTP_HOST ?? '127.0.0.1',
    SMTP_PORT: process.env.TEST_SMTP_PORT ?? '1025',
    EMAIL_FROM_ADDRESS: 'no-reply@vetudy.test',
    EMAIL_FROM_NAME: 'Vetudy tests',
    UPLOADS_DIR: path.join(os.tmpdir(), `vetudy-${databaseName}-uploads`),
    NODE_OPTIONS: '--no-deprecation',
  }
}
