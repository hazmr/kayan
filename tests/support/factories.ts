import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

import { ADMIN_ID, type Role } from '@/access/roles'
import { TRUSTED_USER_WRITE } from '@/collections/Users/hooks'
import type { CourseStatus } from '@/lib/courses/transitions'
import { approveReceipt } from '@/lib/orders/reviewReceipt'
import { startOrder } from '@/lib/orders/startOrder'
import { submitReceipt, type UploadedImage } from '@/lib/orders/submitReceipt'
import { createAdmin } from '@/lib/users/createAdmin'
import type { Category, Course, Lesson, Order, User } from '@/payload-types'

/** Every test user has this password, so password-confirmed actions can be tested. */
export const PASSWORD = 'test-password-123'

let counter = 0
/** A name no other test has used, so files can share one database without clashing. */
export const unique = (label: string): string =>
  `${label}-${process.pid}-${Date.now().toString(36)}-${++counter}`

/** A real 1x1 PNG, small enough to upload as a receipt. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
export const receiptFile = (): UploadedImage => ({
  data: PNG,
  mimetype: 'image/png',
  name: 'receipt.png',
  size: PNG.length,
})

/**
 * A user with this role. The Admin is special: there is exactly one, with id zero (the database
 * enforces it), so asking for a 'superadmin' returns that one account, creating it the first time.
 */
export async function makeUser(
  payload: Payload,
  role: Role,
  label: string = role,
  email?: string,
): Promise<User> {
  if (role === 'superadmin') {
    const existing = await payload
      .findByID({ collection: 'users', id: ADMIN_ID, depth: 0, overrideAccess: true })
      .catch(() => null)
    return (
      existing ??
      createAdmin(payload, {
        email: email ?? 'admin@kayan.test',
        password: PASSWORD,
        name: 'Test Admin',
      })
    )
  }
  const slug = unique(label)
  return payload.create({
    collection: 'users',
    data: {
      name: `Test ${label}`,
      email: email ?? `${slug}@kayan.test`,
      password: PASSWORD,
      role,
      _verified: true,
    },
    // Roles are normally written only by the owner through a password-confirmed endpoint. Tests
    // set them directly, the same way the create-superadmin script does.
    context: { [TRUSTED_USER_WRITE]: true },
    disableVerificationEmail: true,
    overrideAccess: true,
  })
}

/** A request as if `user` (or a guest, for null) were calling. Use a new one per call. */
export function requestFor(payload: Payload, user: User | null): Promise<PayloadRequest> {
  return createLocalReq({ user: user ?? undefined }, payload)
}

export async function makeCategory(payload: Payload, parent?: Category): Promise<Category> {
  return payload.create({
    collection: 'categories',
    data: { title: unique('category'), ...(parent ? { parent: parent.id } : {}) },
    locale: 'ar',
    overrideAccess: true,
  })
}

interface CourseOptions {
  /** Piasters. */
  price?: number
  status?: CourseStatus
}

export async function makeCourse(
  payload: Payload,
  doctor: User,
  options: CourseOptions = {},
): Promise<Course> {
  const course = await payload.create({
    collection: 'courses',
    data: {
      title: unique('course'),
      description: 'Test course',
      owner: doctor.id,
      price: options.price ?? 40000,
      status: 'draft',
    },
    locale: 'ar',
    overrideAccess: true,
  })
  const status = options.status ?? 'published'
  if (status === 'draft') return course
  // The status field is closed to everyone; tests set it directly to get a course into a state.
  return payload.update({
    collection: 'courses',
    id: course.id,
    data: { status },
    locale: 'ar',
    overrideAccess: true,
  })
}

export async function makeLesson(
  payload: Payload,
  course: Course,
  options: { free?: boolean; videoId?: string } = {},
): Promise<Lesson> {
  const courseModule = await payload.create({
    collection: 'modules',
    data: { title: unique('module'), course: course.id, position: 1 },
    locale: 'ar',
    overrideAccess: true,
  })
  return payload.create({
    collection: 'lessons',
    data: {
      title: unique('lesson'),
      module: courseModule.id,
      position: 1,
      videoProvider: 'youtube',
      videoId: options.videoId ?? 'dQw4w9WgXcQ',
      durationSeconds: 60,
      isFreePreview: options.free ?? false,
    },
    locale: 'ar',
    overrideAccess: true,
  })
}

/** The Admin's percent of each new sale. Each test file sets the value its numbers assume. */
export async function setAdminSharePercent(payload: Payload, percent: number): Promise<void> {
  await payload.updateGlobal({
    slug: 'platform-settings',
    data: { adminSharePercent: percent },
    overrideAccess: true,
  })
}

export async function setPaymentSettings(payload: Payload): Promise<void> {
  await payload.updateGlobal({
    slug: 'payment-settings',
    data: { instapayAddress: 'test@instapay', vodafoneCashNumber: '01000000000' },
    overrideAccess: true,
  })
}

/** The student pressed Buy and uploaded a receipt: the order waits for the Admin or an instructor. */
export async function makeAwaitingReview(
  payload: Payload,
  student: User,
  course: Course,
): Promise<Order> {
  const { order } = await startOrder({
    courseId: course.id,
    method: 'instapay',
    req: await requestFor(payload, student),
  })
  return submitReceipt({
    orderId: order.id,
    file: receiptFile(),
    senderNumber: '01012345678',
    expectedAmount: course.price,
    req: await requestFor(payload, student),
  })
}

/** A finished sale: bought, receipt uploaded, approved by `approver` (the Admin or an instructor). */
export async function makePaidOrder(
  payload: Payload,
  student: User,
  course: Course,
  approver: User,
): Promise<Order> {
  const waiting = await makeAwaitingReview(payload, student, course)
  return approveReceipt(waiting.id, await requestFor(payload, approver))
}

export async function enrollmentsOf(payload: Payload, user: User, course: Course) {
  const { docs } = await payload.find({
    collection: 'enrollments',
    where: { and: [{ user: { equals: user.id } }, { course: { equals: course.id } }] },
    depth: 0,
    overrideAccess: true,
  })
  return docs
}

export async function reload(payload: Payload, order: Order): Promise<Order> {
  return payload.findByID({ collection: 'orders', id: order.id, depth: 0, overrideAccess: true })
}
