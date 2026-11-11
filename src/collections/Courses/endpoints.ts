import type { Endpoint, PayloadRequest } from 'payload'

import { changeCourseStatus } from '@/lib/courses/changeCourseStatus'
import type { CourseStatus } from '@/lib/courses/transitions'
import { AppError } from '@/lib/errors/AppError'

function courseIdFrom(req: PayloadRequest): string {
  const id = req.routeParams?.id
  if (typeof id !== 'string' || id === '') throw new AppError('NOT_FOUND')
  return id
}

async function noteFrom(req: PayloadRequest): Promise<string | undefined> {
  const body: unknown = await req.json?.().catch(() => null)
  if (
    typeof body === 'object' &&
    body !== null &&
    'note' in body &&
    typeof body.note === 'string'
  ) {
    return body.note
  }
  return undefined
}

/** Each endpoint is one arrow in the course status diagram. All rules live in changeCourseStatus. */
function statusEndpoint(path: string, to: CourseStatus, withNote = false): Endpoint {
  return {
    path: `/:id/${path}`,
    method: 'post',
    handler: async (req) => {
      const course = await changeCourseStatus({
        courseId: courseIdFrom(req),
        to,
        note: withNote ? await noteFrom(req) : undefined,
        req,
      })
      return Response.json({ id: course.id, status: course.status })
    },
  }
}

export const courseEndpoints: Endpoint[] = [
  statusEndpoint('submit', 'in_review'),
  statusEndpoint('publish', 'published'),
  statusEndpoint('send-back', 'draft', true),
  statusEndpoint('archive', 'archived'),
  statusEndpoint('unarchive', 'published'),
]
