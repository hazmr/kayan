// The shapes pages receive. They list exactly what a visitor may see, which is why
// pages use these instead of raw database documents: a video id has nowhere to hide here.

export interface CatalogImage {
  url: string
  alt: string
}

export interface CourseCardData {
  slug: string
  title: string
  /** Whole pounds. 0 means free. */
  priceEgp: number
  ownerName: string
  categoryTitle: string | null
  thumbnail: CatalogImage | null
}

export interface LessonOutline {
  id: string
  title: string
  durationSeconds: number
  isFreePreview: boolean
}

export interface ModuleOutline {
  id: string
  title: string
  lessons: LessonOutline[]
}

export interface CourseDetail extends CourseCardData {
  id: string
  description: string
  modules: ModuleOutline[]
  lessonCount: number
  totalSeconds: number
}

export interface CategoryNode {
  slug: string
  title: string
  children: { slug: string; title: string }[]
}
