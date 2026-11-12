import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

import { DATABASE_SERVER } from './env'

const SAFE_NAME = /^[a-z0-9_]+$/

function sql(statement: string): void {
  // `psql <address>/postgres` connects to the server's maintenance database, which is the only
  // place a database can be dropped and created from.
  execFileSync(
    'psql',
    [`${DATABASE_SERVER}/postgres`, '-v', 'ON_ERROR_STOP=1', '-q', '-c', statement],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
}

/**
 * Drops and recreates the test database, then builds its tables with the project's REAL
 * migration files (the same command used in production), so a migration mistake fails the tests.
 */
export function prepareDatabase(databaseName: string, env: Record<string, string>): void {
  if (!SAFE_NAME.test(databaseName)) throw new Error(`Unsafe test database name: ${databaseName}`)
  try {
    sql(`drop database if exists "${databaseName}" with (force)`)
    sql(`create database "${databaseName}"`)
  } catch (error) {
    throw new Error(
      'Could not create the test database. Is Postgres running (pnpm services:up) and is `psql` installed?\n' +
        String(error),
    )
  }
  execFileSync('pnpm', ['migrate'], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  fs.rmSync(env.UPLOADS_DIR ?? '', { recursive: true, force: true })
}

export function removeUploads(env: Record<string, string>): void {
  if (env.UPLOADS_DIR) fs.rmSync(env.UPLOADS_DIR, { recursive: true, force: true })
}
