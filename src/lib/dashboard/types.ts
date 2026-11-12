import type { Role } from '@/access/roles'
import type { CourseStatus } from '@/lib/courses/transitions'

/** A value stored once per language. English may be empty; Arabic never is. */
export interface Localized {
  ar: string
  en: string
}

export interface CourseRow {
  id: string
  title: Localized
  status: CourseStatus
  ownerName: string
  priceEgp: number
  updatedAt: string
}

export interface LessonEdit {
  id: string
  title: Localized
  position: number
  videoProvider: 'youtube' | 'bunny'
  videoId: string
  durationSeconds: number
  isFreePreview: boolean
}

export interface ModuleEdit {
  id: string
  title: Localized
  position: number
  lessons: LessonEdit[]
}

export interface CourseEdit {
  id: string
  slug: string
  title: Localized
  description: Localized
  status: CourseStatus
  categoryId: string
  thumbnail: { id: string; url: string } | null
  priceEgp: number
  owner: { id: string; name: string }
  modules: ModuleEdit[]
  /** What the person looking at the page may do. Decided on the server, checked again by the API. */
  can: {
    editPrice: boolean
    /** Only the Admin changes which instructor teaches a course. */
    editOwner: boolean
    moveTo: CourseStatus[]
  }
}

export interface CategoryOption {
  id: string
  slug: string
  title: Localized
  parentId: string | null
}

export interface UserRow {
  id: string
  name: string
  email: string
  role: Role
  verified: boolean
}

export interface PersonOption {
  id: string
  name: string
  email: string
}
