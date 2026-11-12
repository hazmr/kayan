import { getLocale, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { CheckoutForm } from '@/components/orders/CheckoutForm'
import { Link, redirect } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { getPublishedCourse } from '@/lib/catalog'
import { getPurchaseState } from '@/lib/orders/queries'
import { availableMethods, getPaymentSettings } from '@/lib/payments/settings'
import config from '@payload-config'
import { getPayload } from 'payload'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function CheckoutPage({ params }: PageProps) {
  const [{ slug }, locale, user, t] = await Promise.all([
    params,
    getLocale(),
    getCurrentUser(),
    getTranslations('checkout'),
  ])
  if (!user) {
    return redirect({ href: { pathname: '/login', query: { next: `/checkout/${slug}` } }, locale })
  }

  // Doctors and staff never buy: the course page shows them what they can do instead.
  if (user.role !== 'student') return redirect({ href: `/courses/${slug}`, locale })

  const course = await getPublishedCourse(slug, locale)
  if (!course) notFound()

  // Already owns it, or already has an order going: send them there instead of starting another.
  const state = await getPurchaseState(user, course.id)
  if (state.kind === 'enrolled') return redirect({ href: `/courses/${slug}`, locale })
  if (state.kind === 'open') return redirect({ href: `/orders/${state.reference}`, locale })

  const methods = availableMethods(await getPaymentSettings(await getPayload({ config })))

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <CheckoutForm
        courseId={course.id}
        courseTitle={course.title}
        priceEgp={course.priceEgp}
        methods={methods}
      />
      <Link
        href={`/courses/${slug}`}
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        {t('back')}
      </Link>
    </section>
  )
}
