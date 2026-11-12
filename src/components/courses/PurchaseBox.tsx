import { getTranslations } from 'next-intl/server'

import { hasRole, isStaff } from '@/access/roles'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import type { CourseProgress, LearnState } from '@/lib/progress/calculate'
import { getPurchaseState } from '@/lib/orders/queries'
import type { User } from '@/payload-types'

import { ProgressBar } from './ProgressBar'

interface PurchaseBoxProps {
  courseId: string
  /** The doctor who owns the course, so the box can tell a doctor they are looking at their own. */
  ownerId: string
  slug: string
  priceEgp: number
  user: User | null
  /** Where "Continue learning" goes for a student who owns the course. */
  resumeLessonId?: string
  learnState?: LearnState
  progress?: CourseProgress
}

/** The button under the price: what a visitor can do about this course, given who they are. */
export async function PurchaseBox({
  courseId,
  ownerId,
  slug,
  priceEgp,
  user,
  resumeLessonId,
  learnState = 'start',
  progress,
}: PurchaseBoxProps) {
  // Only students buy. Doctors and staff get a box that fits their role instead of a Buy button.
  if (user && !hasRole(user, 'student')) {
    const t = await getTranslations('buy')
    const own = user.id === ownerId
    const canManage = isStaff(user) || own
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          {own ? t('yourCourse') : isStaff(user) ? t('staffView') : t('doctorView')}
        </p>
        {canManage && (
          <Button asChild size="lg">
            <Link href={`/dashboard/courses/${courseId}`}>{t('manageCourse')}</Link>
          </Button>
        )}
      </div>
    )
  }

  const [t, state] = await Promise.all([getTranslations('buy'), getPurchaseState(user, courseId)])
  const isFree = priceEgp === 0
  const checkout = `/checkout/${slug}`

  if (state.kind === 'guest') {
    return (
      <div className="flex flex-col gap-2">
        <Button asChild size="lg">
          <Link href={{ pathname: '/login', query: { next: checkout } }}>
            {isFree ? t('loginToEnroll') : t('loginToBuy')}
          </Link>
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {t('noAccount')}{' '}
          <Link href="/register" className="text-primary underline-offset-4 hover:underline">
            {t('createAccount')}
          </Link>
        </p>
      </div>
    )
  }

  if (state.kind === 'enrolled') {
    return (
      <div className="flex flex-col gap-2">
        <p className="rounded-lg bg-primary/10 p-3 text-center text-sm font-medium text-primary">
          {t('owned')}
        </p>
        {progress && progress.total > 0 && (
          <ProgressBar progress={progress} label={t('progressLabel')} />
        )}
        {resumeLessonId && (
          <Button asChild size="lg">
            <Link href={`/courses/${slug}/lessons/${resumeLessonId}`}>
              {t(`learn.${learnState}`)}
            </Link>
          </Button>
        )}
      </div>
    )
  }

  if (state.kind === 'open') {
    return (
      <div className="flex flex-col gap-2">
        {state.status === 'awaiting_review' && (
          <p className="text-center text-sm text-muted-foreground">{t('inReview')}</p>
        )}
        <Button asChild size="lg">
          <Link href={`/orders/${state.reference}`}>
            {state.status === 'awaiting_review' ? t('viewOrder') : t('continueOrder')}
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <Button asChild size="lg">
      <Link href={checkout}>{isFree ? t('enrollFree') : t('buyNow')}</Link>
    </Button>
  )
}
