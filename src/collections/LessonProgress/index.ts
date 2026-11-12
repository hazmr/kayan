import type { Access, CollectionConfig } from 'payload'

import { closed } from '@/access/orders'

import { collectionLabels } from '../shared/labels'
import { progressEndpoints } from './endpoints'

/**
 * A student reads only their own progress, and nobody (staff included) reads anyone else's:
 * how a student studies is theirs. Writes go through src/lib/progress, never the generic API.
 */
const readOwn: Access = ({ req: { user } }) => (user ? { user: { equals: user.id } } : false)

/** One row per lesson a student has marked as complete. Marking it again does nothing new. */
export const LessonProgress: CollectionConfig = {
  slug: 'lesson-progress',
  labels: collectionLabels(['Lesson progress', 'تقدم الدرس'], ['Lesson progress', 'تقدم الدروس']),
  access: { read: readOwn, create: closed, update: closed, delete: closed },
  endpoints: progressEndpoints,
  // A student completes a lesson once: the database refuses a second row for the same pair.
  indexes: [{ fields: ['user', 'lesson'], unique: true }],
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'course', type: 'relationship', relationTo: 'courses', required: true, index: true },
    { name: 'lesson', type: 'relationship', relationTo: 'lessons', required: true, index: true },
    { name: 'completedAt', type: 'date', required: true },
  ],
}
