import type { Metadata } from 'next'
import { Lock } from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { LessonCompleteButton } from '@/components/courses/LessonCompleteButton'
import { ProgressBar } from '@/components/courses/ProgressBar'
import { WatchSidebar } from '@/components/courses/WatchSidebar'
import { summarizeProgress } from '@/lib/progress/calculate'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { getWatchPage } from '@/lib/catalog/watch'

interface PageProps {
  params: Promise<{ slug: string; lessonId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [{ slug, lessonId }, locale, user] = await Promise.all([
    params,
    getLocale(),
    getCurrentUser(),
  ])
  const page = await getWatchPage(slug, lessonId, user, locale)
  // The title is part of the public outline, so it is fine to show for locked lessons too.
  return page.kind === 'notFound' ? {} : { title: `${page.current.title} | ${page.course.title}` }
}

export default async function LessonPage({ params }: PageProps) {
  const [{ slug, lessonId }, locale, user, t] = await Promise.all([
    params,
    getLocale(),
    getCurrentUser(),
    getTranslations('watch'),
  ])
  const page = await getWatchPage(slug, lessonId, user, locale)
  if (page.kind === 'notFound') notFound()

  const { course, current, previous, next, position } = page
  const here = `/courses/${slug}/lessons/${lessonId}`
  const completedIds = new Set(page.progress.completedIds)
  const progress = summarizeProgress(
    page.modules.flatMap((courseModule) => courseModule.lessons.map((lesson) => lesson.id)),
    completedIds,
  )

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_340px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Link
          href={`/courses/${slug}`}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          ← {t('back')}: {course.title}
        </Link>

        {page.kind === 'ok' ? (
          <div className="aspect-video overflow-hidden rounded-xl border bg-black">
            <iframe
              src={page.embedUrl}
              title={t('videoTitle', { title: current.title })}
              className="size-full"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center gap-4 rounded-xl border bg-muted p-6 text-center">
            <Lock className="size-10 text-muted-foreground" aria-hidden />
            <h2 className="text-xl font-bold">{t('lockedTitle')}</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {course.priceEgp === 0 ? t('lockedFree') : t('lockedBody')}
            </p>
            {!page.loggedIn && <p className="text-sm text-muted-foreground">{t('lockedGuest')}</p>}
            <div className="flex flex-wrap justify-center gap-2">
              {/* Only students buy; a doctor or staff member sees the plain explanation. */}
              {(!user || user.role === 'student') && (
                <Button asChild>
                  <Link href={`/courses/${slug}`}>
                    {course.priceEgp === 0 ? t('enroll') : t('buy')}
                  </Link>
                </Button>
              )}
              {!page.loggedIn && (
                <>
                  <Button asChild variant="outline">
                    <Link href={{ pathname: '/login', query: { next: here } }}>{t('login')}</Link>
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href="/register">{t('register')}</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl leading-snug font-bold">{current.title}</h1>
          <p className="text-sm text-muted-foreground">
            {t('lessonOf', { number: position.number, total: position.total })}
          </p>
        </div>

        {page.kind === 'ok' && page.progress.trackable && (
          <LessonCompleteButton lessonId={current.id} completed={completedIds.has(current.id)} />
        )}

        <div className="flex flex-wrap justify-between gap-2">
          {previous?.watchable ? (
            <Button asChild variant="outline">
              <Link href={`/courses/${slug}/lessons/${previous.id}`}>← {t('previous')}</Link>
            </Button>
          ) : (
            <span />
          )}
          {next?.watchable && (
            <Button asChild>
              <Link href={`/courses/${slug}/lessons/${next.id}`}>{t('next')} →</Link>
            </Button>
          )}
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        {page.progress.trackable && <ProgressBar progress={progress} label={t('progressTitle')} />}
        <WatchSidebar
          modules={page.modules}
          courseSlug={slug}
          currentId={current.id}
          completedIds={page.progress.completedIds}
        />
      </aside>
    </div>
  )
}
