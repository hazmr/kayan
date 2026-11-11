import type { CollectionConfig } from 'payload'

import { anyone, createCourseContent, staffOnly } from '@/access/courses'

import { collectionLabels, label } from '../shared/labels'

// Public images such as course thumbnails. Videos are never uploaded here.
export const Media: CollectionConfig = {
  slug: 'media',
  labels: collectionLabels(['Image', 'صورة'], ['Images', 'الصور']),
  access: {
    read: anyone,
    create: createCourseContent,
    update: staffOnly,
    delete: staffOnly,
  },
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    // One resized copy for course cards, so the catalog does not download full-size uploads.
    imageSizes: [{ name: 'card', width: 640, height: 360, position: 'centre' }],
    adminThumbnail: 'card',
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: label('Description for screen readers', 'وصف الصورة لقارئات الشاشة'),
      localized: true,
      maxLength: 200,
    },
  ],
}
