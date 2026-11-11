import { getTranslations } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { getPurchaseState } from '@/lib/orders/queries'
import type { User } from '@/payload-types'

interface PurchaseBoxProps {
  courseId: string
  slug: string
  priceEgp: number
  user: User | null
  /** Where "Start learning" goes for a student who owns the course. */
  firstLessonId?: string
}

/** The button under the price: what a visitor can do about this course, given who they are. */
export async function PurchaseBox({
  courseId,
  slug,
  priceEgp,
  user,
  firstLessonId,
}: PurchaseBoxProps) {
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
        {firstLessonId && (
          <Button asChild size="lg">
            <Link href={`/courses/${slug}/lessons/${firstLessonId}`}>{t('startLearning')}</Link>
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
