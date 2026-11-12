import type { PayloadRequest } from 'payload'

import type { Locale } from '@/i18n/locales'
import { env } from '@/lib/env'

import { bilingualSubject, renderBilingualEmail } from './layout'
import { sendToEach, staffEmails } from './recipients'

interface AdminPaymentEmail {
  kind: 'recorded' | 'removed'
  /** Piasters. */
  amount: number
  paidAt: Date
  note: string
  /** Who recorded or removed it. */
  by: string
  /** What is still owed to the Admin after the change, in piasters. */
  owed: number
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

const link = (locale: Locale) => `${env.siteUrl}/${locale}/dashboard/earnings`

/** Tells the Admin and every instructor, so both sides always agree on the balance. */
export async function sendAdminPaymentEmail(
  req: PayloadRequest,
  args: AdminPaymentEmail,
): Promise<void> {
  const { kind, amount, paidAt, note, by, owed } = args
  const recorded = kind === 'recorded'
  const html = renderBilingualEmail({
    ar: {
      heading: recorded ? 'تم تسجيل دفعة لمسؤول النظام' : 'تم حذف سجل دفعة لمسؤول النظام',
      paragraphs: [
        recorded
          ? `سجّل ${by} دفعة بقيمة ${money(amount, 'ar')} بتاريخ ${day(paidAt, 'ar')}.`
          : `حذف ${by} سجل الدفعة البالغة ${money(amount, 'ar')} بتاريخ ${day(paidAt, 'ar')}، غالباً لتصحيح خطأ.`,
        ...(note ? [`ملاحظة: ${note}`] : []),
        `المتبقي لمسؤول النظام الآن: ${money(owed, 'ar')}.`,
      ],
      action: { label: 'عرض الحساب', url: link('ar') },
    },
    en: {
      heading: recorded ? 'A payment to the Admin was recorded' : 'A payment record was removed',
      paragraphs: [
        recorded
          ? `${by} recorded a payment of ${money(amount, 'en')} on ${day(paidAt, 'en')}.`
          : `${by} removed the record of ${money(amount, 'en')} dated ${day(paidAt, 'en')}, usually to correct a mistake.`,
        ...(note ? [`Note: ${note}`] : []),
        `Still owed to the Admin: ${money(owed, 'en')}.`,
      ],
      action: { label: 'View the account', url: link('en') },
    },
  })
  const subject = recorded
    ? bilingualSubject('تم تسجيل دفعة', 'Payment recorded')
    : bilingualSubject('تم حذف سجل دفعة', 'Payment record removed')
  await sendToEach(req, await staffEmails(req), subject, html, 'Admin payment')
}

/** Where students send their money changed. Everyone who runs the academy must know at once. */
export async function sendPaymentDetailsChangedEmail(
  req: PayloadRequest,
  args: {
    by: string
    before: { instapay: string; vodafone: string }
    after: { instapay: string; vodafone: string }
  },
): Promise<void> {
  const { by, before, after } = args
  const none = { ar: '(فارغ)', en: '(empty)' }
  const line = (locale: Locale, name: string, from: string, to: string) =>
    `${name}: ${from || none[locale]} → ${to || none[locale]}`
  const html = renderBilingualEmail({
    ar: {
      heading: 'تغيّرت بيانات الدفع',
      paragraphs: [
        `غيّر ${by} المكان الذي يرسل إليه الطلاب أموالهم.`,
        line('ar', 'إنستاباي', before.instapay, after.instapay),
        line('ar', 'فودافون كاش', before.vodafone, after.vodafone),
        'إذا لم تكن تتوقع هذا التغيير، راجع الإعدادات فوراً.',
      ],
      action: { label: 'فتح الإعدادات', url: `${env.siteUrl}/ar/dashboard/settings` },
    },
    en: {
      heading: 'The payment details changed',
      paragraphs: [
        `${by} changed where students send their money.`,
        line('en', 'InstaPay', before.instapay, after.instapay),
        line('en', 'Vodafone Cash', before.vodafone, after.vodafone),
        'If you did not expect this, check the settings at once.',
      ],
      action: { label: 'Open settings', url: `${env.siteUrl}/en/dashboard/settings` },
    },
  })
  await sendToEach(
    req,
    await staffEmails(req),
    bilingualSubject('تغيّرت بيانات الدفع', 'Payment details changed'),
    html,
    'Payment details',
  )
}
