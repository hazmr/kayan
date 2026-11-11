import type { Payload } from 'payload'

import type { Locale } from '@/i18n/locales'
import { env } from '@/lib/env'
import type { Course, Order, User } from '@/payload-types'

import { bilingualSubject, renderBilingualEmail, type EmailSection } from './layout'

/** The pieces every order email needs. Loaded once by the caller. */
export interface OrderEmailContext {
  order: Order
  student: Pick<User, 'name' | 'email'>
  /** The course title in both languages. English falls back to Arabic when empty. */
  courseTitle: { ar: string; en: string }
  payload: Payload
}

function money(piasters: number, locale: Locale): string {
  const pounds = piasters / 100
  return locale === 'ar' ? `${pounds} جنيه` : `EGP ${pounds}`
}

function orderLink(locale: Locale, reference: string): string {
  return `${env.siteUrl}/${locale}/orders/${encodeURIComponent(reference)}`
}

/** Emails never stop a payment from going through: a failure is logged and the work stands. */
async function send(payload: Payload, to: string[], subject: string, html: string): Promise<void> {
  await Promise.all(
    [...new Set(to)].map((address) =>
      payload.sendEmail({ to: address, subject, html }).catch((error: unknown) => {
        payload.logger.error({ err: error, msg: 'Order email failed' })
      }),
    ),
  )
}

function studentEmail(
  ctx: OrderEmailContext,
  content: { ar: Omit<EmailSection, 'action'>; en: Omit<EmailSection, 'action'> },
  subject: { ar: string; en: string },
): Promise<void> {
  const { order } = ctx
  const html = renderBilingualEmail({
    ar: { ...content.ar, action: { label: 'عرض الطلب', url: orderLink('ar', order.reference) } },
    en: { ...content.en, action: { label: 'View order', url: orderLink('en', order.reference) } },
  })
  return send(ctx.payload, [ctx.student.email], bilingualSubject(subject.ar, subject.en), html)
}

export function sendReceiptApprovedEmail(ctx: OrderEmailContext): Promise<void> {
  const { courseTitle, order } = ctx
  return studentEmail(
    ctx,
    {
      ar: {
        heading: 'تم قبول الدفع',
        paragraphs: [
          `تم تأكيد دفعك لدورة «${courseTitle.ar}» بمبلغ ${money(order.amount, 'ar')}.`,
          'يمكنك الآن البدء في مشاهدة الدورة.',
        ],
      },
      en: {
        heading: 'Payment approved',
        paragraphs: [
          `Your payment of ${money(order.amount, 'en')} for "${courseTitle.en}" is confirmed.`,
          'You can start watching the course now.',
        ],
      },
    },
    { ar: 'تم قبول الدفع', en: 'Payment approved' },
  )
}

export function sendReceiptRejectedEmail(ctx: OrderEmailContext, note: string): Promise<void> {
  const { courseTitle } = ctx
  return studentEmail(
    ctx,
    {
      ar: {
        heading: 'لم يتم قبول الإيصال',
        paragraphs: [
          `لم نتمكن من تأكيد دفعك لدورة «${courseTitle.ar}».`,
          `ملاحظة المراجع: ${note}`,
          'يمكنك رفع إيصال جديد من صفحة الطلب.',
        ],
      },
      en: {
        heading: 'Your receipt was not accepted',
        paragraphs: [
          `We could not confirm your payment for "${courseTitle.en}".`,
          `Reviewer's note: ${note}`,
          'You can upload a new receipt from the order page.',
        ],
      },
    },
    { ar: 'لم يتم قبول الإيصال', en: 'Receipt not accepted' },
  )
}

export function sendRefundDeclinedEmail(ctx: OrderEmailContext, note: string): Promise<void> {
  const { courseTitle } = ctx
  return studentEmail(
    ctx,
    {
      ar: {
        heading: 'تم رفض طلب الاسترداد',
        paragraphs: [
          `لم تتم الموافقة على طلب استرداد دورة «${courseTitle.ar}».`,
          `ملاحظة المراجع: ${note}`,
          'ما زال بإمكانك مشاهدة الدورة.',
        ],
      },
      en: {
        heading: 'Refund request declined',
        paragraphs: [
          `Your refund request for "${courseTitle.en}" was not approved.`,
          `Reviewer's note: ${note}`,
          'You can still watch the course.',
        ],
      },
    },
    { ar: 'تم رفض طلب الاسترداد', en: 'Refund request declined' },
  )
}

export function sendRefundedEmail(ctx: OrderEmailContext): Promise<void> {
  const { courseTitle, order } = ctx
  return studentEmail(
    ctx,
    {
      ar: {
        heading: 'تم استرداد المبلغ',
        paragraphs: [
          `تم إرجاع مبلغ ${money(order.amount, 'ar')} الخاص بدورة «${courseTitle.ar}».`,
          'تم إيقاف الوصول إلى الدورة.',
        ],
      },
      en: {
        heading: 'Your refund was sent',
        paragraphs: [
          `${money(order.amount, 'en')} for "${courseTitle.en}" has been sent back to you.`,
          'Access to the course has been removed.',
        ],
      },
    },
    { ar: 'تم استرداد المبلغ', en: 'Refund sent' },
  )
}

/** Tells every manager and owner that a receipt is waiting for them. */
export async function sendReceiptSubmittedEmail(ctx: OrderEmailContext): Promise<void> {
  const { courseTitle, order, student, payload } = ctx
  const { docs } = await payload.find({
    collection: 'users',
    where: { role: { in: ['superadmin', 'manager'] } },
    depth: 0,
    limit: 100,
    overrideAccess: true,
  })
  const url = (locale: Locale) => `${env.siteUrl}/${locale}/dashboard/payments`
  const html = renderBilingualEmail({
    ar: {
      heading: 'إيصال جديد بانتظار المراجعة',
      paragraphs: [
        `رفع ${student.name} إيصال دفع لدورة «${courseTitle.ar}» بمبلغ ${money(order.amount, 'ar')}.`,
        `رقم الطلب: ${order.reference}`,
      ],
      action: { label: 'مراجعة المدفوعات', url: url('ar') },
    },
    en: {
      heading: 'A new receipt is waiting for review',
      paragraphs: [
        `${student.name} uploaded a receipt for "${courseTitle.en}", ${money(order.amount, 'en')}.`,
        `Order reference: ${order.reference}`,
      ],
      action: { label: 'Review payments', url: url('en') },
    },
  })
  await send(
    payload,
    docs.map((user) => user.email),
    bilingualSubject('إيصال جديد بانتظار المراجعة', 'New receipt to review'),
    html,
  )
}

/** Loads the course title in both languages for an email. */
export async function courseTitleOf(
  payload: Payload,
  course: Course | string,
): Promise<{ ar: string; en: string }> {
  const id = typeof course === 'string' ? course : course.id
  const loaded = await payload.findByID({
    collection: 'courses',
    id,
    depth: 0,
    locale: 'all',
    overrideAccess: true,
  })
  const title = loaded.title as unknown
  const record =
    typeof title === 'object' && title !== null ? (title as Record<string, unknown>) : {}
  const ar = typeof record.ar === 'string' ? record.ar : ''
  const en = typeof record.en === 'string' && record.en !== '' ? record.en : ar
  return { ar, en }
}
