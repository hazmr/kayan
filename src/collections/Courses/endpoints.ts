import type { Endpoint, PayloadRequest } from 'payload'

import { changeCourseStatus } from '@/lib/courses/changeCourseStatus'
import type { CourseStatus } from '@/lib/courses/transitions'
import { AppError } from '@/lib/errors/AppError'

function courseIdFrom(req: PayloadRequest): string {
  const id = req.routeParams?.id
  if (typeof id !== 'string' || id === '') throw new AppError('NOT_FOUND')
  return id
}

/** Each endpoint is one arrow in the course status diagram. All rules live in changeCourseStatus. */
function statusEndpoint(path: string, to: CourseStatus): Endpoint {
  return {
    path: `/:id/${path}`,
    method: 'post',
    handler: async (req) => {
      const course = await changeCourseStatus({ courseId: courseIdFrom(req), to, req })
      return Response.json({ id: course.id, status: course.status })
    },
  }
}

export const courseEndpoints: Endpoint[] = [
  statusEndpoint('publish', 'published'),
  statusEndpoint('archive', 'archived'),
  statusEndpoint('unarchive', 'published'),
]
