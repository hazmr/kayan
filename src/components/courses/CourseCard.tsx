import Image from 'next/image'

import { Link } from '@/i18n/navigation'
import type { CourseCardData } from '@/lib/catalog/types'

import { CoursePrice } from './CoursePrice'

export function CourseCard({ course }: { course: CourseCardData }) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-video bg-muted">
        {course.thumbnail && (
          <Image
            src={course.thumbnail.url}
            alt={course.thumbnail.alt}
            fill
            sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {course.categoryTitle && (
          <span className="text-xs text-muted-foreground">{course.categoryTitle}</span>
        )}
        <h3 className="leading-snug font-semibold group-hover:text-primary">{course.title}</h3>
        <p className="text-sm text-muted-foreground">{course.ownerName}</p>
        <CoursePrice priceEgp={course.priceEgp} className="mt-auto pt-2 font-bold text-primary" />
      </div>
    </Link>
  )
}

export function CourseGrid({ courses }: { courses: CourseCardData[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((course) => (
        <CourseCard key={course.slug} course={course} />
      ))}
    </div>
  )
}
