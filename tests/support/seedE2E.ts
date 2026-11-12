// Fills the browser test's database with the people and the course it needs.
// Run by tests/e2e/global-setup.ts through `payload run`, with the test environment.

import config from '@payload-config'
import { getPayload } from 'payload'

import { E2E } from './e2eData'
import { makeUser, setAdminSharePercent, setPaymentSettings } from './factories'

const payload = await getPayload({ config })

await makeUser(payload, 'superadmin', 'owner', E2E.owner)
await makeUser(payload, 'admin', 'son', E2E.son)
const doctor = await makeUser(payload, 'admin', 'doctor', E2E.doctor)
await makeUser(payload, 'student', 'student', E2E.student)
await setPaymentSettings(payload)
// The Admin earns 30% of each sale, so a EGP 400 sale is EGP 120 to the Admin and EGP 280 to the academy.
await setAdminSharePercent(payload, 30)

// EGP 400. Titled in Arabic (the default language); English falls back.
const course = await payload.create({
  collection: 'courses',
  data: {
    title: E2E.courseTitle,
    description: 'A course made for the browser test.',
    owner: doctor.id,
    price: 40000,
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
