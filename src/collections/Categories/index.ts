import type {
  CollectionBeforeDeleteHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  Where,
} from 'payload'

import { anyone, staffOnly } from '@/access/courses'
import { isStaff } from '@/access/roles'
import { AppError } from '@/lib/errors/AppError'
import type { Category } from '@/payload-types'

import { collectionLabels, label } from '../shared/labels'
import { relationId } from '../shared/relationId'
import { requireArabic } from '../shared/requireArabic'
import { resolveSlug, slugField } from '../shared/slug'

/** Categories have two levels: a subcategory's parent must itself be a top-level category. */
const enforceTwoLevels: CollectionBeforeValidateHook<Category> = async ({
  data,
  originalDoc,
  req,
}) => {
  if (!data) return data
  data.slug = resolveSlug(data.slug ?? originalDoc?.slug, data.title, 'category')

  const parentId = relationId(data.parent)
  if (!parentId) return data

  // On create Payload passes an empty original document, so check for a real id.
  const existingId = originalDoc?.id
  if (parentId === existingId) throw new AppError('CATEGORY_TOO_DEEP')

  const parent = await req.payload.findByID({
    collection: 'categories',
    id: parentId,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (relationId(parent.parent)) throw new AppError('CATEGORY_TOO_DEEP')

  // A category that already has children cannot become a child: that would make three levels.
  if (existingId) {
    const children = await req.payload.count({
      collection: 'categories',
      where: { parent: { equals: existingId } },
      overrideAccess: true,
      req,
    })
    if (children.totalDocs > 0) throw new AppError('CATEGORY_TOO_DEEP')
  }
  return data
}

const refuseDeleteWhenInUse: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const [children, courses] = await Promise.all([
    req.payload.count({
      collection: 'categories',
      where: { parent: { equals: id } },
      overrideAccess: true,
      req,
    }),
    req.payload.count({
      collection: 'courses',
      where: { category: { equals: id } },
      overrideAccess: true,
      req,
    }),
  ])
  if (children.totalDocs > 0 || courses.totalDocs > 0) throw new AppError('CATEGORY_IN_USE')
}

export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: collectionLabels(['Category', 'تصنيف'], ['Categories', 'التصنيفات']),
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'parent', 'slug'],
    // Doctors only pick a category inside the course form.
    hidden: ({ user }) => !isStaff(user),
  },
  access: {
    read: anyone,
    create: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  hooks: {
    beforeValidate: [requireArabic(['title']), enforceTwoLevels],
    beforeDelete: [refuseDeleteWhenInUse],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: label('Title', 'العنوان'),
      // Arabic is required by the requireArabic hook. Not `required` here: Payload would then
      // demand a value in every language, and English is optional.
      localized: true,
      maxLength: 120,
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'categories',
      label: label('Parent category', 'التصنيف الرئيسي'),
      index: true,
      // Only top-level categories can be chosen, and never the category itself.
      filterOptions: ({ id }): Where => {
        const topLevel: Where = { parent: { exists: false } }
        return id ? { and: [topLevel, { id: { not_equals: id } }] } : topLevel
      },
      admin: {
        description: label(
          'Leave empty for a main category. Choose one to make this a subcategory.',
          'اتركه فارغاً للتصنيف الرئيسي. اختر تصنيفاً ليصبح هذا تصنيفاً فرعياً.',
        ),
      },
    },
    slugField,
  ],
}
