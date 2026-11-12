import type { Payload } from 'payload'

import type { Locale } from '@/i18n/locales'
import { env } from '@/lib/env'

import { bilingualSubject, renderBilingualEmail } from './layout'

interface PayoutEmail {
  payload: Payload
  doctor: { name: string; email: string }
  /** Piasters. */
  amount: number
  paidAt: Date
  note: string
  /** The doctor's balance after the change, in piasters. */
  balance: number
}

function money(piasters: number, locale: Locale): string {
  const pounds = piasters / 100
  const text = Number.isInteger(pounds) ? String(pounds) : pounds.toFixed(2)
  return locale === 'ar' ? `${text} جنيه` : `EGP ${text}`
}

function day(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
  }).format(date)
}

async function send(payload: Payload, to: string, subject: string, html: string): Promise<void> {
  // A failed email never undoes the record: it is logged and the work stands.
  await payload.sendEmail({ to, subject, html }).catch((error: unknown) => {
    payload.logger.error({ err: error, msg: 'Payout email failed' })
  })
}

const link = (locale: Locale) => `${env.siteUrl}/${locale}/dashboard/earnings`

export function sendPayoutRecordedEmail(args: PayoutEmail): Promise<void> {
  const { doctor, amount, paidAt, note, balance } = args
  const html = renderBilingualEmail({
    ar: {
      heading: 'تم تسجيل دفعة لك',
      paragraphs: [
        `تم تحويل ${money(amount, 'ar')} إليك بتاريخ ${day(paidAt, 'ar')}.`,
        ...(note ? [`ملاحظة: ${note}`] : []),
        `رصيدك الحالي: ${money(balance, 'ar')}.`,
      ],
      action: { label: 'عرض أرباحك', url: link('ar') },
    },
    en: {
      heading: 'A payout was recorded for you',
      paragraphs: [
        `${money(amount, 'en')} was sent to you on ${day(paidAt, 'en')}.`,
        ...(note ? [`Note: ${note}`] : []),
        `Your balance now: ${money(balance, 'en')}.`,
      ],
      action: { label: 'View your earnings', url: link('en') },
    },
  })
  return send(
    args.payload,
    doctor.email,
    bilingualSubject('تم تسجيل دفعة', 'Payout recorded'),
    html,
  )
}

export function sendPayoutRemovedEmail(args: PayoutEmail): Promise<void> {
  const { doctor, amount, paidAt, balance } = args
  const html = renderBilingualEmail({
    ar: {
      heading: 'تم حذف سجل دفعة',
      paragraphs: [
        `تم حذف سجل الدفعة البالغة ${money(amount, 'ar')} بتاريخ ${day(paidAt, 'ar')}، غالباً لتصحيح خطأ في التسجيل.`,
        `رصيدك الحالي: ${money(balance, 'ar')}.`,
        'إذا كان لديك استفسار، تواصل مع مالك المنصة.',
      ],
      action: { label: 'عرض أرباحك', url: link('ar') },
    },
    en: {
      heading: 'A payout record was removed',
      paragraphs: [
        `The record of ${money(amount, 'en')} dated ${day(paidAt, 'en')} was removed, usually to correct a mistake.`,
        `Your balance now: ${money(balance, 'en')}.`,
        'If you have a question, contact the platform owner.',
      ],
      action: { label: 'View your earnings', url: link('en') },
    },
  })
  return send(
    args.payload,
    doctor.email,
    bilingualSubject('تم حذف سجل دفعة', 'Payout record removed'),
    html,
  )
}
