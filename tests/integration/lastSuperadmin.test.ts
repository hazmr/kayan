import type { Endpoint, Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { Users } from '@/collections/Users'
import { TRUSTED_USER_WRITE } from '@/collections/Users/hooks'
import type { User } from '@/payload-types'

import { makeUser, PASSWORD, requestFor } from '../support/factories'
import { startApp, stopApp } from '../support/payload'

// "The last superadmin can never be demoted or deleted."
//
// The other test files leave extra owners in the shared test database, so this file first sets
// them aside (as managers) to make the owner it creates the only one, and puts them back after.

let payload: Payload
const setAside: string[] = []

const trusted = { [TRUSTED_USER_WRITE]: true }
const roleOf = async (user: User) =>
  (await payload.findByID({ collection: 'users', id: user.id, overrideAccess: true })).role

async function otherOwners(except: User[]): Promise<User[]> {
  const { docs } = await payload.find({
    collection: 'users',
    where: {
      and: [{ role: { equals: 'superadmin' } }, { id: { not_in: except.map((user) => user.id) } }],
    },
    pagination: false,
    overrideAccess: true,
  })
  return docs
}

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
})
afterAll(async () => {
  for (const id of setAside) {
    await payload.update({
      collection: 'users',
      id,
      data: { role: 'superadmin' },
      context: trusted,
      overrideAccess: true,
    })
  }
  await stopApp(payload)
})

async function onlyOwners(...keep: User[]): Promise<void> {
  for (const other of await otherOwners(keep)) {
    await payload.update({
      collection: 'users',
      id: other.id,
      data: { role: 'manager' },
      context: trusted,
      overrideAccess: true,
    })
    setAside.push(other.id)
  }
}

describe('the last owner', () => {
  it('cannot be demoted, even by a trusted server script', async () => {
    const owner = await makeUser(payload, 'superadmin')
    await onlyOwners(owner)

    await expect(
      payload.update({
        collection: 'users',
        id: owner.id,
        data: { role: 'manager' },
        context: trusted,
        overrideAccess: true,
      }),
    ).rejects.toMatchObject({ code: 'LAST_SUPERADMIN' })
    expect(await roleOf(owner)).toBe('superadmin')
  })

  it('cannot be deleted', async () => {
    const owner = await makeUser(payload, 'superadmin')
    await onlyOwners(owner)

    await expect(
      payload.delete({ collection: 'users', id: owner.id, overrideAccess: true }),
    ).rejects.toMatchObject({
      code: 'LAST_SUPERADMIN',
    })
    expect(await roleOf(owner)).toBe('superadmin')
  })

  it('can be demoted or deleted once another owner exists, and then the remaining one is protected', async () => {
    const first = await makeUser(payload, 'superadmin')
    const second = await makeUser(payload, 'superadmin')
    await onlyOwners(first, second)

    // first demotes second through the real, password-confirmed endpoint
    await callEndpoint('/:id/role', first, second.id, { role: 'manager', password: PASSWORD })
    expect(await roleOf(second)).toBe('manager')

    // now first is the last one
    await expect(
      payload.update({
        collection: 'users',
        id: first.id,
        data: { role: 'student' },
        context: trusted,
        overrideAccess: true,
      }),
    ).rejects.toMatchObject({ code: 'LAST_SUPERADMIN' })
    await expect(
      payload.delete({ collection: 'users', id: first.id, overrideAccess: true }),
    ).rejects.toMatchObject({
      code: 'LAST_SUPERADMIN',
    })
    // The former owner, now a manager, cannot touch the real owner. (Each request loads the user
    // fresh from the database, so the demotion is already in effect.)
    const formerOwner = await payload.findByID({
      collection: 'users',
      id: second.id,
      overrideAccess: true,
    })
    await expect(
      callEndpoint('/:id/role', formerOwner, first.id, { role: 'student', password: PASSWORD }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    expect(await roleOf(first)).toBe('superadmin')
  })

  it('an owner can delete another owner while at least two exist', async () => {
    const first = await makeUser(payload, 'superadmin')
    const second = await makeUser(payload, 'superadmin')
    await onlyOwners(first, second)

    await callEndpoint('/:id/delete', first, second.id, { password: PASSWORD })
    await expect(
      payload.findByID({ collection: 'users', id: second.id, overrideAccess: true }),
    ).rejects.toThrow()
    expect(await roleOf(first)).toBe('superadmin')
  })

  it('an owner cannot demote or delete themselves, even with a second owner around', async () => {
    const first = await makeUser(payload, 'superadmin')
    await makeUser(payload, 'superadmin')
    await expect(
      callEndpoint('/:id/role', first, first.id, { role: 'student', password: PASSWORD }),
    ).rejects.toMatchObject({
      code: 'SELF_CHANGE_NOT_ALLOWED',
    })
    await expect(
      callEndpoint('/:id/delete', first, first.id, { password: PASSWORD }),
    ).rejects.toMatchObject({
      code: 'SELF_CHANGE_NOT_ALLOWED',
    })
  })
})
