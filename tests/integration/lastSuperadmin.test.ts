import type { Endpoint, Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN_ID } from '@/access/roles'
import { Users } from '@/collections/Users'
import { TRUSTED_USER_WRITE } from '@/collections/Users/hooks'
import { createAdmin } from '@/lib/users/createAdmin'
import type { User } from '@/payload-types'

import { makeUser, PASSWORD, requestFor } from '../support/factories'
import { startApp, stopApp } from '../support/payload'

// "There is exactly one Admin, it is id zero, and it can never be demoted or deleted."
// Some of this is the app's rules, and some is the database itself (migration admin_is_id_zero):
// both are tried, the database with the app's checks skipped where possible.

let payload: Payload
let admin: User

const trusted = { [TRUSTED_USER_WRITE]: true }
const roleOf = async (user: User) =>
  (await payload.findByID({ collection: 'users', id: user.id, overrideAccess: true })).role

async function callEndpoint(
  path: string,
  user: User,
  targetId: string,
  body: Record<string, unknown>,
) {
  const endpoint = (Users.endpoints as Endpoint[]).find((candidate) => candidate.path === path)!
  const req = await requestFor(payload, user)
  req.routeParams = { id: targetId }
  req.json = async () => body
  return endpoint.handler(req)
}

beforeAll(async () => {
  payload = await startApp()
  admin = await makeUser(payload, 'superadmin')
})
afterAll(() => stopApp(payload))

describe('the Admin', () => {
  it('is id zero', () => {
    expect(admin.id).toBe(ADMIN_ID)
    expect(admin.role).toBe('superadmin')
  })

  it('cannot be demoted, even by a trusted server script', async () => {
    await expect(
      payload.update({
        collection: 'users',
        id: admin.id,
        data: { role: 'admin' },
        context: trusted,
        overrideAccess: true,
      }),
    ).rejects.toMatchObject({ code: 'LAST_SUPERADMIN' })
    expect(await roleOf(admin)).toBe('superadmin')
  })

  it('cannot be deleted', async () => {
    await expect(
      payload.delete({ collection: 'users', id: admin.id, overrideAccess: true }),
    ).rejects.toMatchObject({ code: 'LAST_SUPERADMIN' })
    expect(await roleOf(admin)).toBe('superadmin')
  })

  it('cannot change or delete itself through the endpoints either', async () => {
    await expect(
      callEndpoint('/:id/role', admin, admin.id, { role: 'student', password: PASSWORD }),
    ).rejects.toMatchObject({ code: 'SELF_CHANGE_NOT_ALLOWED' })
    await expect(
      callEndpoint('/:id/delete', admin, admin.id, { password: PASSWORD }),
    ).rejects.toMatchObject({ code: 'SELF_CHANGE_NOT_ALLOWED' })
  })
})

describe('only one Admin can ever exist', () => {
  it('the create script refuses a second one', async () => {
    await expect(
      createAdmin(payload, { email: 'second@kayan.test', password: PASSWORD, name: 'Second' }),
    ).rejects.toThrow('only one')
  })

  it('the database itself refuses to make anyone else Admin, even with every app check skipped', async () => {
    const someone = await makeUser(payload, 'admin')
    await expect(
      payload.update({
        collection: 'users',
        id: someone.id,
        data: { role: 'superadmin' },
        context: trusted,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
    expect(await roleOf(someone)).toBe('admin')
  })

  it('and refuses a new account created directly as Admin', async () => {
    await expect(
      payload.create({
        collection: 'users',
        data: {
          email: `direct-${Date.now()}@kayan.test`,
          password: PASSWORD,
          name: 'Direct',
          role: 'superadmin',
        },
        context: trusted,
        overrideAccess: true,
        disableVerificationEmail: true,
      }),
    ).rejects.toThrow()
  })
})
