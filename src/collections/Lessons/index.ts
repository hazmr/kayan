import type {
  CollectionBeforeDeleteHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  FieldAccess,
} from 'payload'

import { createCourseContent, editCourseContent, readCourseContent } from '@/access/courses'
import { isStaff } from '@/access/roles'
import { assertCanEditCourse } from '@/lib/courses/assertCanEditCourse'
import { AppError } from '@/lib/errors/AppError'
import type { Lesson } from '@/payload-types'

import { collectionLabels, label } from '../shared/labels'
import { relationId } from '../shared/relationId'
import { requireArabic } from '../shared/requireArabic'

export const VIDEO_PROVIDERS = ['youtube', 'bunny'] as const

/**
 * A lesson's course always comes from its module, never from the request.
 * Why store it at all: access rules can then check the course with one join instead of two.
 */
const syncCourseFromModule: CollectionBeforeValidateHook<Lesson> = async ({
  data,
  originalDoc,
  req,
}) => {
  if (!data) return data
  const moduleId = relationId(data.module ?? originalDoc?.module)
  if (!moduleId) return data // the required-field validation reports the missing module

  const parent = await req.payload
    .findByID({ collection: 'modules', id: moduleId, depth: 0, overrideAccess: true, req })
    .catch(() => null)
  const courseId = relationId(parent?.course)
  if (!courseId) throw new AppError('VALIDATION_FAILED')

  await assertCanEditCourse(courseId, req)
  data.course = courseId
  return data
}

/**
 * The video id is the secret part of a lesson. Only the Admin and instructors read it through
 * the API. Students never do: the player page resolves it on the server after checking access.
 */
const readVideoId: FieldAccess<Lesson> = ({ req }) => isStaff(req.user)

/** Students' "completed" marks point at the lesson, so they go first when a lesson is deleted. */
const removeLessonProgress: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({
    collection: 'lesson-progress',
    where: { lesson: { equals: id } },
    overrideAccess: true,
    req,
  })
}

export const Lessons: CollectionConfig = {
  slug: 'lessons',
  labels: collectionLabels(['Lesson', 'درس'], ['Lessons', 'الدروس']),
  defaultSort: 'position',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'module', 'position', 'isFreePreview'],
  },
  access: {
    read: readCourseContent('course.'),
    create: createCourseContent,
    update: editCourseContent('course.'),
    delete: editCourseContent('course.'),
  },
  hooks: {
    beforeValidate: [requireArabic(['title']), syncCourseFromModule],
    beforeDelete: [removeLessonProgress],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: label('Title', 'العنوان'),
      // Arabic is required by the requireArabic hook. Not `required` here: Payload would then
      // demand a value in every language, and English is optional.
      localized: true,
      maxLength: 160,
    },
    {
      name: 'module',
      type: 'relationship',
      relationTo: 'modules',
      label: label('Module', 'الوحدة'),
      required: true,
      index: true,
    },
    {
      name: 'course',
      type: 'relationship',
      relationTo: 'courses',
      label: label('Course', 'الدورة'),
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: label('Filled in from the module.', 'تُملأ تلقائياً من الوحدة.'),
      },
    },
    {
      name: 'position',
      type: 'number',
      label: label('Order', 'الترتيب'),
      required: true,
      defaultValue: 1,
      min: 0,
      admin: {
        step: 1,
        description: label('Lower numbers come first.', 'الرقم الأصغر يظهر أولاً.'),
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'videoProvider',
          type: 'select',
          label: label('Video host', 'مكان الفيديو'),
          required: true,
          defaultValue: 'youtube',
          // Bunny appears here when its adapter is added.
          options: [{ label: 'YouTube', value: 'youtube' }],
          access: { read: readVideoId },
        },
        {
          name: 'videoId',
          type: 'text',
          label: label('Video ID', 'معرّف الفيديو'),
          required: true,
          maxLength: 100,
          access: { read: readVideoId },
          admin: {
            description: label(
              'Only the ID, not the full link. For youtube.com/watch?v=abc123 the ID is abc123.',
              'المعرّف فقط وليس الرابط كاملاً. في youtube.com/watch?v=abc123 المعرّف هو abc123.',
            ),
          },
          validate: (value: unknown) =>
            (typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value)) ||
            'Enter only the video ID: letters, numbers, dashes, and underscores.',
        },
      ],
    },
    {
      name: 'durationSeconds',
      type: 'number',
      label: label('Length in seconds', 'المدة بالثواني'),
      required: true,
      defaultValue: 0,
      min: 0,
      admin: { step: 1 },
    },
    {
      name: 'isFreePreview',
      type: 'checkbox',
      label: label('Free preview', 'معاينة مجانية'),
      defaultValue: false,
      admin: {
        description: label(
          'Anyone can watch this lesson without buying the course.',
          'يمكن لأي شخص مشاهدة هذا الدرس دون شراء الدورة.',
        ),
      },
    },
  ],
}
