// Fills the browser test's database with the people and the course it needs.
// Run by tests/e2e/global-setup.ts through `payload run`, with the test environment.

import config from '@payload-config'
import { getPayload } from 'payload'

import { MASTER_OWNER_SCRIPT } from '@/collections/Users/hooks'

import { E2E } from './e2eData'
import { makeUser, setPaymentSettings } from './factories'

const payload = await getPayload({ config })

const master = await makeUser(payload, 'superadmin', 'owner', E2E.owner)
await makeUser(payload, 'superadmin', 'second owner', E2E.owner2)
// The first owner is the master owner, as the real owner will be (what `pnpm master:set` does).
await payload.update({
  collection: 'users',
  id: master.id,
  data: { isMasterOwner: true },
  context: { [MASTER_OWNER_SCRIPT]: true },
  overrideAccess: true,
})
await makeUser(payload, 'manager', 'manager', E2E.manager)
const doctor = await makeUser(payload, 'admin', 'doctor', E2E.doctor)
await makeUser(payload, 'student', 'student', E2E.student)
await setPaymentSettings(payload)

// EGP 400, doctor keeps 70% (EGP 280). Titled in Arabic (the default language); English falls back.
const course = await payload.create({
  collection: 'courses',
  data: {
    title: E2E.courseTitle,
    description: 'A course made for the browser test.',
    owner: doctor.id,
    price: 40000,
    ownerSharePercent: 70,
    status: 'draft',
  },
  locale: 'ar',
  overrideAccess: true,
})
await payload.update({
  collection: 'courses',
  id: course.id,
  data: { status: 'published' },
  locale: 'ar',
  overrideAccess: true,
})

const courseModule = await payload.create({
  collection: 'modules',
  data: { title: 'E2E Module', course: course.id, position: 1 },
  locale: 'ar',
  overrideAccess: true,
})
const lesson = (title: string, position: number, videoId: string, free: boolean) =>
  payload.create({
    collection: 'lessons',
    data: {
      title,
      module: courseModule.id,
      position,
      videoProvider: 'youtube',
      videoId,
      durationSeconds: 120,
      isFreePreview: free,
    },
    locale: 'ar',
    overrideAccess: true,
  })
await lesson(E2E.previewLesson, 1, E2E.previewVideoId, true)
await lesson(E2E.lockedLesson, 2, E2E.lockedVideoId, false)

console.log('E2E data ready.')
process.exit(0)
