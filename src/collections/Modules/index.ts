import type {
  CollectionBeforeDeleteHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from 'payload'

import { createCourseContent, editCourseContent, readCourseContent } from '@/access/courses'
import { assertCanEditCourse } from '@/lib/courses/assertCanEditCourse'
import type { Module } from '@/payload-types'

import { collectionLabels, label } from '../shared/labels'
import { relationId } from '../shared/relationId'
import { requireArabic } from '../shared/requireArabic'

/** A doctor may add a module only to their own course, and may not move one into someone else's. */
const checkCourseOwnership: CollectionBeforeValidateHook<Module> = async ({ data, req }) => {
  const courseId = relationId(data?.course)
  if (courseId) await assertCanEditCourse(courseId, req)
  return data
}

const deleteLessons: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({
    collection: 'lessons',
    where: { module: { equals: id } },
    overrideAccess: true,
    req,
  })
}

export const Modules: CollectionConfig = {
  slug: 'modules',
  labels: collectionLabels(['Module', 'وحدة'], ['Modules', 'الوحدات']),
  defaultSort: 'position',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'course', 'position'],
  },
  access: {
    read: readCourseContent('course.'),
    create: createCourseContent,
    update: editCourseContent('course.'),
    delete: editCourseContent('course.'),
  },
  hooks: {
    beforeValidate: [requireArabic(['title']), checkCourseOwnership],
    beforeDelete: [deleteLessons],
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
      name: 'course',
      type: 'relationship',
      relationTo: 'courses',
      label: label('Course', 'الدورة'),
      required: true,
      index: true,
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
      name: 'lessons',
      type: 'join',
      collection: 'lessons',
      on: 'module',
      label: label('Lessons', 'الدروس'),
      defaultSort: 'position',
    },
  ],
}
