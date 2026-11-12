import type { Endpoint, Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { Users } from '@/collections/Users'
import { MASTER_OWNER_SCRIPT, TRUSTED_USER_WRITE } from '@/collections/Users/hooks'
import { listUsers } from '@/lib/dashboard/queries'
import { applyRoleChange } from '@/lib/users/ownerPromotion'
import type { User } from '@/payload-types'

import { makeUser, PASSWORD, requestFor } from '../support/factories'
import { startApp, stopApp } from '../support/payload'

// "The master owner": one account that nobody can demote, edit, or delete from the app, not even
// another owner. Only the server command (which sets MASTER_OWNER_SCRIPT) can move the title.

let payload: Payload
let master: User
let otherOwner: User

const script = { [MASTER_OWNER_SCRIPT]: true }
const PROTECTED = { code: 'MASTER_OWNER_PROTECTED' }

async function setMaster(user: User, value: boolean) {
  await payload.update({
    collection: 'users',
    id: user.id,
    data: { isMasterOwner: value },
    context: script,
    overrideAccess: true,
  })
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

const reload = (user: User) =>
  payload.findByID({ collection: 'users', id: user.id, overrideAccess: true })

beforeAll(async () => {
  payload = await startApp()
  master = await makeUser(payload, 'superadmin', 'master')
  otherOwner = await makeUser(payload, 'superadmin', 'other-owner')
  await setMaster(master, true)
})
afterAll(async () => {
  // Leave the shared test database as found: no master owner.
  await setMaster(master, false)
  await stopApp(payload)
})

describe('nobody else can touch the master owner', () => {
  it("another owner cannot change the master's role, by the endpoint or by any other route", async () => {
    await expect(
      callEndpoint('/:id/role', otherOwner, master.id, { role: 'manager', password: PASSWORD }),
    ).rejects.toMatchObject(PROTECTED)
    // the "trusted" internal path the endpoint uses is not an exception either
    await expect(
      applyRoleChange(master, 'manager', otherOwner, await requestFor(payload, otherOwner)),
    ).rejects.toMatchObject(PROTECTED)
    await expect(
      payload.update({
        collection: 'users',
        id: master.id,
        data: { role: 'student' },
        context: { [TRUSTED_USER_WRITE]: true },
        user: otherOwner,
        overrideAccess: true,
      }),
    ).rejects.toMatchObject(PROTECTED)
    expect((await reload(master)).role).toBe('superadmin')
  })

  it("another owner cannot delete the master, or edit the master's name, email, or password", async () => {
    await expect(
      callEndpoint('/:id/delete', otherOwner, master.id, { password: PASSWORD }),
    ).rejects.toMatchObject(PROTECTED)

    for (const data of [
      { name: 'Hacked' },
      { email: 'hacked@example.test' },
      { password: 'a-brand-new-password' },
      { _verified: false },
    ]) {
      await expect(
        payload.update({
          collection: 'users',
          id: master.id,
          data,
          user: otherOwner,
          overrideAccess: false,
        }),
        JSON.stringify(Object.keys(data)),
      ).rejects.toMatchObject(PROTECTED)
    }
    expect((await reload(master)).name).not.toBe('Hacked')
  })

  it('even a direct delete in our own code is refused', async () => {
    await expect(
      payload.delete({ collection: 'users', id: master.id, overrideAccess: true }),
    ).rejects.toMatchObject(PROTECTED)
    expect(await reload(master)).toBeTruthy()
  })

  it('no one can make an account master (or clear the title) through the app', async () => {
    const someone = await makeUser(payload, 'superadmin', 'someone')
    await expect(
      payload.update({
        collection: 'users',
        id: someone.id,
        data: { isMasterOwner: true },
        user: otherOwner,
        overrideAccess: true,
      }),
    ).rejects.toMatchObject(PROTECTED)
    // not even the master can hand the title over, or drop it
    await expect(
      payload.update({
        collection: 'users',
        id: master.id,
        data: { isMasterOwner: false },
        user: master,
        overrideAccess: true,
      }),
    ).rejects.toMatchObject(PROTECTED)
    await expect(
      payload.create({
        collection: 'users',
        data: {
          email: `forged-${Date.now()}@example.test`,
          password: PASSWORD,
          name: 'Forged',
          role: 'student',
          isMasterOwner: true,
        },
        user: otherOwner,
        overrideAccess: true,
      }),
    ).rejects.toMatchObject(PROTECTED)
    expect((await reload(master)).isMasterOwner).toBe(true)
  })

  it('the database itself allows only one master owner', async () => {
    const someone = await makeUser(payload, 'superadmin', 'second')
    await expect(setMaster(someone, true)).rejects.toThrow()
    expect((await reload(someone)).isMasterOwner).toBeFalsy()
  })
})

describe('the master owner can still run their own account', () => {
  it('edits their own name, and changes their own password through the endpoint', async () => {
    await payload.update({
      collection: 'users',
      id: master.id,
      data: { name: 'Master renamed', phone: '01000000000' },
      user: master,
      overrideAccess: false,
    })
    expect(await reload(master)).toMatchObject({ name: 'Master renamed', phone: '01000000000' })

    const endpoint = (Users.endpoints as Endpoint[]).find((e) => e.path === '/change-password')!
    const req = await requestFor(payload, master)
    req.json = async () => ({ currentPassword: PASSWORD, newPassword: PASSWORD })
    await expect(endpoint.handler(req)).resolves.toBeTruthy()
  })

  it('cannot be demoted, even by their own hand', async () => {
    await expect(
      payload.update({
        collection: 'users',
        id: master.id,
        data: { role: 'manager' },
        context: { [TRUSTED_USER_WRITE]: true },
        user: master,
        overrideAccess: true,
      }),
    ).rejects.toMatchObject(PROTECTED)
    expect((await reload(master)).role).toBe('superadmin')
  })

  it('and is shown as master in the users list, while other owners are not', async () => {
    const rows = await listUsers(otherOwner)
    expect(rows.find((row) => row.id === master.id)?.master).toBe(true)
    expect(rows.find((row) => row.id === otherOwner.id)?.master).toBe(false)
  })
})

describe('everyone else is unaffected', () => {
  it('another owner can still change a normal account', async () => {
    const student = await makeUser(payload, 'student')
    await payload.update({
      collection: 'users',
      id: student.id,
      data: { name: 'Renamed by an owner' },
      user: otherOwner,
      overrideAccess: false,
    })
    expect((await reload(student)).name).toBe('Renamed by an owner')
    await expect(
      callEndpoint('/:id/role', otherOwner, student.id, { role: 'manager', password: PASSWORD }),
    ).resolves.toBeTruthy()
    expect((await reload(student)).role).toBe('manager')
  })
})
