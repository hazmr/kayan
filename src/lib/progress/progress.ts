import config from '@payload-config'
import { getPayload, type PayloadRequest } from 'payload'

import { hasRole } from '@/access/roles'
import { relationId } from '@/collections/shared/relationId'
import { lockRow } from '@/lib/db/lockRow'
import { withTransaction } from '@/lib/db/withTransaction'
import { requireUser } from '@/lib/auth/requireActor'
import { hasActiveEnrollment } from '@/lib/enrollments/enrollments'
import { AppError } from '@/lib/errors/AppError'

/**
 * Marks a lesson complete (or not complete again) for the logged-in student.
 *
 * Only a student with an ACTIVE enrollment can: a guest, a doctor, staff, and a student who has
 * not bought the course (or was refunded) are refused. Safe to call twice: completing twice
 * leaves one row, and un-completing something not completed does nothing.
 */
export async function setLessonCompleted({
  lessonId,
  completed,
  req,
}: {
  lessonId: string
  completed: boolean
  req: PayloadRequest
}): Promise<{ completed: boolean }> {
  const user = requireUser(req)
  if (!hasRole(user, 'student')) throw new AppError('FORBIDDEN')

  const lesson = await req.payload
    .findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 0,
      overrideAccess: true,
      select: { course: true },
      req,
    })
    .catch(() => null)
  const courseId = relationId(lesson?.course)
  if (!lesson || !courseId) throw new AppError('NOT_FOUND')
  if (!(await hasActiveEnrollment(user.id, courseId, req.payload))) {
    throw new AppError('FORBIDDEN')
  }

  await withTransaction(req, async () => {
    // Two clicks at once take turns on this student's row, so the second one finds the first one's row.
    await lockRow(req, 'users', user.id)
    const existing = await req.payload.find({
      collection: 'lesson-progress',
      where: { and: [{ user: { equals: user.id } }, { lesson: { equals: lessonId } }] },
      depth: 0,
      limit: 1,
      overrideAccess: true,
      req,
    })

    if (!completed) {
      if (existing.docs[0]) {
        await req.payload.delete({
          collection: 'lesson-progress',
          id: existing.docs[0].id,
          overrideAccess: true,
          req,
        })
      }
      return
    }
    if (existing.docs[0]) return
    await req.payload.create({
      collection: 'lesson-progress',
      data: {
        user: user.id,
        course: courseId,
        lesson: lessonId,
        completedAt: new Date().toISOString(),
      },
      overrideAccess: true,
      req,
    })
  })
  return { completed }
}

/** The ids of the lessons a student has completed, per course. Courses with none are absent. */
export async function getCompletedLessons(
  userId: string,
  courseIds: readonly string[],
): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>()
  if (courseIds.length === 0) return result
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'lesson-progress',
    where: { and: [{ user: { equals: userId } }, { course: { in: [...courseIds] } }] },
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: { course: true, lesson: true },
  })
  for (const row of docs) {
    const courseId = relationId(row.course)
    const lessonId = relationId(row.lesson)
    if (!courseId || !lessonId) continue
    const set = result.get(courseId) ?? new Set<string>()
    set.add(lessonId)
    result.set(courseId, set)
  }
  return result
}
