import type { Endpoint } from 'payload'

import { AppError } from '@/lib/errors/AppError'
import { setLessonCompleted } from '@/lib/progress/progress'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** POST /api/lesson-progress/set  { lessonId, completed }  (thin: the rules are in src/lib/progress) */
export const progressEndpoints: Endpoint[] = [
  {
    path: '/set',
    method: 'post',
    handler: async (req) => {
      const body: unknown = await req.json?.().catch(() => null)
      const record =
        typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
      const lessonId = record.lessonId
      if (typeof lessonId !== 'string' || !UUID.test(lessonId)) throw new AppError('NOT_FOUND')
      if (typeof record.completed !== 'boolean') throw new AppError('VALIDATION_FAILED')
      const result = await setLessonCompleted({ lessonId, completed: record.completed, req })
      return Response.json(result)
    },
  },
]
