import { getLocale, getTranslations } from 'next-intl/server'
import Image from 'next/image'

import vetClinicImage from '@/assets/home/vet-clinic.webp'
import { CourseGrid } from '@/components/courses/CourseCard'
import { MyCourseCard } from '@/components/courses/MyCourseCard'
import { Reveal } from '@/components/home/Reveal'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { listPublishedCourses } from '@/lib/catalog'
import { listMyCourses } from '@/lib/enrollments/myCourses'

const STEPS = ['choose', 'pay', 'learn'] as const
/** How many of a student's own courses the home page shows before pointing to "My courses". */
const MY_COURSES_SHOWN = 3

// One page, three readers:
//   a guest    the promise, one button (create an account), how buying works, the newest courses
//   a student  a welcome, their own courses with progress first, then the newest courses
//   a doctor or staff member  the promise and the newest courses (their work is in the dashboard)
export default async function HomePage() {
  const locale = await getLocale()
  const [t, tCourses, user, courses] = await Promise.all([
    getTranslations('home'),
    getTranslations('courses'),
    getCurrentUser(),
    listPublishedCourses({ locale, limit: 6 }),
  ])
  const isStudent = user?.role === 'student'
  const myCourses = isStudent ? await listMyCourses(user, locale) : []
  // A student does not need the courses they already own listed again as "newest".
  const owned = new Set(myCourses.map((course) => course.slug))
  const newest = courses.filter((course) => !owned.has(course.slug))

  return (
    <>
      <section
        className={
          'mx-auto grid max-w-6xl items-center gap-8 px-4 lg:grid-cols-2 lg:gap-12 ' +
          (isStudent ? 'py-8 sm:py-10' : 'py-10 sm:py-14')
        }
      >
        <div className="flex flex-col items-start gap-5">
          <h1 className="text-3xl leading-snug font-bold text-balance sm:text-4xl lg:text-5xl lg:leading-tight motion-safe:animate-rise">
            {isStudent ? t('welcomeBack', { name: user.name }) : t('title')}
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground motion-safe:animate-rise [animation-delay:120ms]">
            {isStudent
              ? myCourses.length > 0
                ? t('studentSubtitle')
                : t('studentEmpty')
              : t('subtitle')}
          </p>
          {/* One button, for guests only. Log in, Courses, My courses and Dashboard are in the header. */}
          {!user && (
            <Button
              asChild
              size="lg"
              className="transition-transform hover:-translate-y-0.5 motion-safe:animate-rise [animation-delay:220ms]"
            >
              <Link href="/register">{t('getStarted')}</Link>
            </Button>
          )}
        </div>

        {/* The picture has a white background, so it sits straight on the page with no frame.
            A student came to learn, so on a phone their courses come first and the picture is skipped. */}
        <div
          className={
            'motion-safe:animate-rise [animation-delay:160ms] ' +
            (isStudent ? 'hidden lg:block' : '')
          }
        >
          <Image
            src={vetClinicImage}
            alt={t('heroAlt')}
            priority
            sizes="(min-width: 1024px) 560px, 100vw"
            className="w-full"
          />
        </div>
      </section>

      {/* A student's own courses, with progress and a button that continues where they stopped. */}
      {myCourses.length > 0 && (
        <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-14">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-bold">{t('continueTitle')}</h2>
            {myCourses.length > MY_COURSES_SHOWN && (
              <Link
                href="/my-courses"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                {t('allMyCourses', { count: myCourses.length })}
              </Link>
            )}
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {myCourses.slice(0, MY_COURSES_SHOWN).map((course) => (
              <MyCourseCard key={course.id} course={course} />
            ))}
          </div>
        </section>
      )}

      {/* How buying works: for guests, who do not know yet that payment is by transfer. */}
      {!user && (
        <section className="border-y bg-muted/40">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12">
            <Reveal>
              <h2 className="text-2xl font-bold">{t('stepsTitle')}</h2>
            </Reveal>
            <ol className="grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step}>
                  <Reveal delay={index * 120} className="flex gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="font-semibold">{t(`steps.${step}.title`)}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {t(`steps.${step}.body`)}
                      </p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {newest.length > 0 && (
        <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14">
          <Reveal className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-bold">{tCourses('newest')}</h2>
            <Link
              href="/courses"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              {tCourses('viewAll')}
            </Link>
          </Reveal>
          <Reveal>
            <CourseGrid courses={newest} />
          </Reveal>
        </section>
      )}
    </>
  )
}
