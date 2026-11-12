import { getLocale, getTranslations } from 'next-intl/server'
import Image from 'next/image'

import { CourseGrid } from '@/components/courses/CourseCard'
import { MyCourseCard } from '@/components/courses/MyCourseCard'
import { Reveal } from '@/components/home/Reveal'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { getCatalogStats, listPublishedCourses } from '@/lib/catalog'
import { listMyCourses } from '@/lib/enrollments/myCourses'
import { instructorName, instructorPhoto, instructorTitle, siteName } from '@/lib/site'

const STEPS = ['choose', 'pay', 'learn'] as const
/** How many of a student's own courses the home page shows before pointing to "My courses". */
const MY_COURSES_SHOWN = 3

// One page, three readers:
//   a guest    the promise, one button (create an account), how buying works, the newest courses
//   a student  a welcome, their own courses with progress first, then the newest courses
//   a doctor or staff member  the promise and the newest courses (their work is in the dashboard)
export default async function HomePage() {
  const locale = await getLocale()
  const [t, tCourses, user, courses, stats] = await Promise.all([
    getTranslations('home'),
    getTranslations('courses'),
    getCurrentUser(),
    listPublishedCourses({ locale, limit: 6 }),
    getCatalogStats(),
  ])
  const photo = instructorPhoto()
  const title = instructorTitle(locale)
  const isStudent = user?.role === 'student'
  const myCourses = isStudent ? await listMyCourses(user, locale) : []
  // A student does not need the courses they already own listed again as "newest".
  const owned = new Set(myCourses.map((course) => course.slug))
  const newest = courses.filter((course) => !owned.has(course.slug))

  return (
    <>
      {/* The header: a band inside the page margins (lined up with the logo), with the doctor's
          photo fading into it on the far side, and the promise, one button, and how much there is
          to learn on the near side. */}
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:pt-8 sm:pb-12">
        <section className="relative isolate overflow-hidden rounded-3xl bg-sidebar text-white shadow-lg">
          {photo && (
            <figure
              className={
                'relative h-72 w-full sm:h-96 lg:absolute lg:inset-y-0 lg:end-0 lg:h-auto lg:w-[50%] ' +
                // A student came to learn: on a phone their courses come first, without the photo.
                (isStudent ? 'hidden lg:block' : '')
              }
            >
              <Image
                src={photo}
                alt={t('instructorAlt', { instructor: instructorName(locale) })}
                fill
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                // The photo keeps its full place and only its inner edge fades into the band:
                // downwards on a phone, sideways on a wide screen (towards the text, so the fade
                // follows the reading direction). A little more contrast: the original is pale.
                className="object-cover object-[45%_25%] contrast-[1.08] saturate-[1.08] [mask-image:linear-gradient(to_bottom,black_70%,transparent)] lg:ltr:[mask-image:linear-gradient(to_left,black_82%,transparent)] lg:rtl:[mask-image:linear-gradient(to_right,black_82%,transparent)]"
              />
              {/* A dark shade at the bottom of the photo, so the name reads well on it. */}
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 hidden h-44 bg-gradient-to-t from-black/70 via-black/30 to-transparent lg:block lg:ltr:[mask-image:linear-gradient(to_left,black_70%,transparent)] lg:rtl:[mask-image:linear-gradient(to_right,black_70%,transparent)]"
              />
              <figcaption className="absolute end-8 bottom-7 hidden max-w-sm text-end lg:block">
                <p className="text-lg font-bold">{instructorName(locale)}</p>
                {title && <p className="mt-1 text-sm leading-relaxed text-white/85">{title}</p>}
              </figcaption>
            </figure>
          )}

          <div
            className={
              'relative flex flex-col items-start gap-5 px-6 sm:px-10 lg:px-14 ' +
              (photo && !isStudent ? '-mt-16 pb-10 lg:mt-0 ' : 'py-10 ') +
              (isStudent ? 'lg:py-14' : 'lg:py-20')
            }
          >
            <div className="flex w-full flex-col items-start gap-5 lg:max-w-[48%]">
              <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white/90 ring-1 ring-white/20 motion-safe:animate-rise">
                {siteName(locale)}
              </span>
              <h1 className="text-3xl leading-snug font-bold text-balance sm:text-4xl lg:text-5xl lg:leading-tight motion-safe:animate-rise [animation-delay:80ms]">
                {isStudent
                  ? t('welcomeBack', { name: user.name })
                  : t('title', { instructor: instructorName(locale) })}
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-white/80 motion-safe:animate-rise [animation-delay:160ms]">
                {isStudent
                  ? myCourses.length > 0
                    ? t('studentSubtitle')
                    : t('studentEmpty')
                  : t('subtitle', { instructor: instructorName(locale) })}
              </p>
              {/* One button, for guests only. Log in, Courses, My courses and Dashboard are in the header. */}
              {!user && (
                <Button
                  asChild
                  size="lg"
                  className="bg-white text-primary transition-transform hover:-translate-y-0.5 hover:bg-white/90 motion-safe:animate-rise [animation-delay:240ms]"
                >
                  <Link href="/register">{t('getStarted')}</Link>
                </Button>
              )}
              {stats.courses > 0 && (
                <dl className="mt-2 flex gap-10 border-t border-white/15 pt-5 motion-safe:animate-rise [animation-delay:320ms]">
                  <div className="flex flex-col">
                    <dt className="order-2 text-sm text-white/70">{t('statCourses')}</dt>
                    <dd className="text-3xl font-bold text-sidebar-primary">{stats.courses}</dd>
                  </div>
                  <div className="flex flex-col">
                    <dt className="order-2 text-sm text-white/70">{t('statLessons')}</dt>
                    <dd className="text-3xl font-bold text-sidebar-primary">{stats.lessons}</dd>
                  </div>
                </dl>
              )}
            </div>
          </div>
        </section>
      </div>

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
