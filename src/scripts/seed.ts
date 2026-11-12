// Fills an EMPTY development database with a realistic academy, to try everything by hand:
//
//   SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_NAME='Your name' pnpm seed
//
// It creates:
//   - the Admin (id zero) from SEED_ADMIN_EMAIL / SEED_ADMIN_NAME / SEED_ADMIN_PASSWORD
//   - the instructor (SEED_INSTRUCTOR_EMAIL, default hassan.helal@kayan.test)
//   - 4 categories and 13 published courses from Dr. Hassan Helal's teaching playlists
//   - 5 test students, each in a different situation (paid, waiting for review, not paid yet,
//     refund requested, free course finished), so every dashboard screen has something to show
//   - test payment details (replace them in Settings before going live)
//
// Passwords that are not given are generated and printed once at the end. Development only: it
// refuses to run on a database that already has users.

import { randomBytes } from 'node:crypto'

import config from '@payload-config'
import { createLocalReq, getPayload, type Payload } from 'payload'

import { refundOrder, requestRefund } from '@/lib/orders/refunds'
import { approveReceipt } from '@/lib/orders/reviewReceipt'
import { startOrder } from '@/lib/orders/startOrder'
import { submitReceipt } from '@/lib/orders/submitReceipt'
import { setLessonCompleted } from '@/lib/progress/progress'
import { createAdmin } from '@/lib/users/createAdmin'
import { TRUSTED_USER_WRITE } from '@/collections/Users/hooks'
import type { Course, Lesson, User } from '@/payload-types'

import { SEED_PARTS, SEED_PLAYLISTS, type SeedPlaylist } from './seed-data/hassanHelalPlaylists'

/** The guide has no durations, so every lesson gets this placeholder (10 minutes). */
const PLACEHOLDER_SECONDS = 600
/** Longer playlists are split into parts of this many lessons, so modules are easy to scan. */
const LESSONS_PER_MODULE = 8
/** A 1x1 PNG, used as the test students' receipt screenshots. */
const RECEIPT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

const generatedPassword = () => randomBytes(12).toString('base64url')
const asRequest = (payload: Payload, user: User) => createLocalReq({ user }, payload)

const adminEmail = process.env.SEED_ADMIN_EMAIL
if (!adminEmail) fail('Set SEED_ADMIN_EMAIL (and SEED_ADMIN_NAME) before running the seed.')
const adminName = process.env.SEED_ADMIN_NAME ?? 'Admin'
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? generatedPassword()
const instructorEmail = process.env.SEED_INSTRUCTOR_EMAIL ?? 'hassan.helal@kayan.test'
const testPassword = process.env.SEED_TEST_PASSWORD ?? generatedPassword()

const payload = await getPayload({ config })

const existingUsers = await payload.count({ collection: 'users', overrideAccess: true })
if (existingUsers.totalDocs > 0) {
  fail('This database already has users. The seed only fills an empty database.')
}

// --- people ---------------------------------------------------------------------------------

const admin = await createAdmin(payload, {
  email: adminEmail,
  password: adminPassword,
  name: adminName,
})

async function makeAccount(email: string, name: string, role: 'admin' | 'student'): Promise<User> {
  return payload.create({
    collection: 'users',
    data: { email, name, password: testPassword, role, _verified: true },
    // A role is normally given by the Admin through the dashboard; the seed sets it directly.
    context: { [TRUSTED_USER_WRITE]: true },
    disableVerificationEmail: true,
    overrideAccess: true,
  })
}

const instructor = await makeAccount(instructorEmail, 'د. حسن هلال', 'admin')

const STUDENTS = [
  { email: 'student1@kayan.test', name: 'أحمد محمود' },
  { email: 'student2@kayan.test', name: 'مريم علي' },
  { email: 'student3@kayan.test', name: 'يوسف حسن' },
  { email: 'student4@kayan.test', name: 'سارة إبراهيم' },
  { email: 'student5@kayan.test', name: 'عمر خالد' },
]
const students: User[] = []
for (const student of STUDENTS)
  students.push(await makeAccount(student.email, student.name, 'student'))

// --- settings -------------------------------------------------------------------------------

await payload.updateGlobal({
  slug: 'payment-settings',
  // Test values: replace them in Settings with the academy's real InstaPay and Vodafone Cash.
  data: { instapayAddress: 'test-academy@instapay', vodafoneCashNumber: '01000000000' },
  overrideAccess: true,
})

// --- catalog --------------------------------------------------------------------------------

const categoryByPart = new Map<number, string>()
for (const part of SEED_PARTS) {
  const category = await payload.create({
    collection: 'categories',
    data: { title: part.ar },
    locale: 'ar',
    overrideAccess: true,
  })
  await payload.update({
    collection: 'categories',
    id: category.id,
    data: { title: part.en },
    locale: 'en',
    overrideAccess: true,
  })
  categoryByPart.set(part.number, category.id)
}

/** The first video's YouTube thumbnail, if it can be downloaded. The course works without it. */
async function thumbnailFor(playlist: SeedPlaylist): Promise<string | undefined> {
  const first = playlist.videos[0]
  if (!first) return undefined
  try {
    const response = await fetch(`https://i.ytimg.com/vi/${first.videoId}/hqdefault.jpg`)
    if (!response.ok) return undefined
    const data = Buffer.from(await response.arrayBuffer())
    const media = await payload.create({
      collection: 'media',
      data: { alt: playlist.titleAr },
      file: {
        data,
        mimetype: 'image/jpeg',
        name: `course-${playlist.number}.jpg`,
        size: data.length,
      },
      overrideAccess: true,
    })
    return media.id
  } catch {
    return undefined
  }
}

const ARABIC_PARTS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس']

const courses = new Map<number, Course>()
const lessonsOf = new Map<number, Lesson[]>()
let lessonCount = 0
let thumbnails = 0

for (const playlist of SEED_PLAYLISTS) {
  const thumbnail = await thumbnailFor(playlist)
  if (thumbnail) thumbnails += 1

  const course = await payload.create({
    collection: 'courses',
    data: {
      title: playlist.titleAr,
      description: playlist.descriptionAr,
      owner: instructor.id,
      category: categoryByPart.get(playlist.part),
      price: playlist.priceEgp * 100,
      ...(thumbnail ? { thumbnail } : {}),
      status: 'draft',
    },
    locale: 'ar',
    overrideAccess: true,
  })
  await payload.update({
    collection: 'courses',
    id: course.id,
    data: { title: playlist.titleEn, description: playlist.descriptionEn },
    locale: 'en',
    overrideAccess: true,
  })

  const chunks: (typeof playlist.videos)[] = []
  for (let i = 0; i < playlist.videos.length; i += LESSONS_PER_MODULE) {
    chunks.push(playlist.videos.slice(i, i + LESSONS_PER_MODULE))
  }

  const lessons: Lesson[] = []
  for (const [moduleIndex, videos] of chunks.entries()) {
    const single = chunks.length === 1
    const courseModule = await payload.create({
      collection: 'modules',
      data: {
        title: single ? 'محتوى الدورة' : `الجزء ${ARABIC_PARTS[moduleIndex] ?? moduleIndex + 1}`,
        course: course.id,
        position: moduleIndex + 1,
      },
      locale: 'ar',
      overrideAccess: true,
    })
    await payload.update({
      collection: 'modules',
      id: courseModule.id,
      data: { title: single ? 'Course content' : `Part ${moduleIndex + 1}` },
      locale: 'en',
      overrideAccess: true,
    })

    for (const [position, video] of videos.entries()) {
      lessons.push(
        await payload.create({
          collection: 'lessons',
          data: {
            title: video.title,
            module: courseModule.id,
            position: position + 1,
            videoProvider: 'youtube',
            videoId: video.videoId,
            durationSeconds: PLACEHOLDER_SECONDS,
            // A paid course opens its first lesson as a free preview.
            isFreePreview: playlist.priceEgp > 0 && moduleIndex === 0 && position === 0,
          },
          locale: 'ar',
          overrideAccess: true,
        }),
      )
      lessonCount += 1
    }
  }

  // The status field is closed to the API; the seed publishes directly, like the test helpers.
  const published = await payload.update({
    collection: 'courses',
    id: course.id,
    data: { status: 'published' },
    locale: 'ar',
    overrideAccess: true,
  })
  courses.set(playlist.number, published)
  lessonsOf.set(playlist.number, lessons)
}

// --- the test students' situations ---------------------------------------------------------

const course = (number: number): Course => {
  const found = courses.get(number)
  if (!found) throw new Error(`No course ${number}`)
  return found
}

async function buy(student: User, target: Course, approve: boolean) {
  const { order } = await startOrder({
    courseId: target.id,
    method: 'instapay',
    req: await asRequest(payload, student),
  })
  if (target.price === 0) return order
  const waiting = await submitReceipt({
    orderId: order.id,
    file: {
      data: RECEIPT_PNG,
      mimetype: 'image/png',
      name: 'receipt.png',
      size: RECEIPT_PNG.length,
    },
    senderNumber: '01012345678',
    expectedAmount: target.price,
    req: await asRequest(payload, student),
  })
  return approve ? approveReceipt(waiting.id, await asRequest(payload, instructor)) : waiting
}

async function complete(student: User, number: number, count: number) {
  for (const lesson of (lessonsOf.get(number) ?? []).slice(0, count)) {
    await setLessonCompleted({
      lessonId: lesson.id,
      completed: true,
      req: await asRequest(payload, student),
    })
  }
}

const [ahmed, mariam, youssef, sara, omar] = students as [User, User, User, User, User]

// Ahmed: two paid courses, part-way through the first.
await buy(ahmed, course(1), true)
await buy(ahmed, course(4), true)
await complete(ahmed, 1, 4)

// Mariam: sent a receipt that is waiting for an instructor to check it.
await buy(mariam, course(14), false)

// Youssef: started buying but has not paid yet.
await startOrder({
  courseId: course(12).id,
  method: 'vodafone_cash',
  req: await asRequest(payload, youssef),
})

// Sara: bought a course and asked for her money back.
const saraOrder = await buy(sara, course(5), true)
await requestRefund(
  saraOrder.id,
  { reason: 'اشتريت الدورة بالخطأ', refundTo: '01098765432' },
  await asRequest(payload, sara),
)

// Omar: finished a free course, and was refunded for a paid one earlier.
await buy(omar, course(3), true)
await complete(omar, 3, lessonsOf.get(3)?.length ?? 0)
const omarOrder = await buy(omar, course(6), true)
await refundOrder(omarOrder.id, await asRequest(payload, instructor))

console.log(`
Seeded: ${courses.size} courses, ${lessonCount} lessons, ${SEED_PARTS.length} categories, ${thumbnails} thumbnails.

  Admin       ${admin.email}  (id ${admin.id})
              password: ${process.env.SEED_ADMIN_PASSWORD ? '(the one you gave)' : adminPassword}
  Instructor  ${instructor.email}
  Students    ${STUDENTS.map((student) => student.email).join(', ')}
              password for the instructor and the students: ${process.env.SEED_TEST_PASSWORD ? '(the one you gave)' : testPassword}

Change the passwords from the Account page. Replace the test payment details in Settings.
`)
process.exit(0)
