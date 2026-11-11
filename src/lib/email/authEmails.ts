import type { Locale } from '@/i18n/locales'
import { env } from '@/lib/env'
import { AppError } from '@/lib/errors/AppError'

import { bilingualSubject, renderBilingualEmail } from './layout'

interface Recipient {
  name?: string | null
}

/** Each language section links to the page in its own language. */
function pageUrl(locale: Locale, path: string, token: string): string {
  return `${env.siteUrl}/${locale}/${path}?token=${encodeURIComponent(token)}`
}

function greeting(recipient: Recipient | undefined, locale: Locale): string {
  const name = recipient?.name?.trim()
  if (locale === 'ar') return name ? `مرحباً ${name}،` : 'مرحباً،'
  return name ? `Hello ${name},` : 'Hello,'
}

// --- Email verification -------------------------------------------------------

export function verifyEmailSubject(): string {
  return bilingualSubject('تأكيد بريدك الإلكتروني', 'Verify your email')
}

export function verifyEmailHTML({ token, user }: { token: string; user: Recipient }): string {
  return renderBilingualEmail({
    ar: {
      heading: 'تأكيد بريدك الإلكتروني',
      paragraphs: [
        greeting(user, 'ar'),
        'شكراً لتسجيلك في Vetudy. اضغط على الزر التالي لتأكيد بريدك الإلكتروني وتفعيل حسابك.',
        'إذا لم تقم بإنشاء هذا الحساب، يمكنك تجاهل هذه الرسالة.',
      ],
      action: { label: 'تأكيد البريد الإلكتروني', url: pageUrl('ar', 'verify-email', token) },
    },
    en: {
      heading: 'Verify your email',
      paragraphs: [
        greeting(user, 'en'),
        'Thanks for signing up to Vetudy. Use the button below to verify your email and activate your account.',
        'If you did not create this account, you can ignore this message.',
      ],
      action: { label: 'Verify email', url: pageUrl('en', 'verify-email', token) },
    },
  })
}

// --- Password reset -----------------------------------------------------------

export function resetPasswordSubject(): string {
  return bilingualSubject('إعادة تعيين كلمة المرور', 'Reset your password')
}

export function resetPasswordHTML(args?: { token?: string; user?: Recipient }): string {
  const token = args?.token
  if (!token) {
    // Payload always passes a token here. If it ever does not, sending a dead link would be worse.
    throw new AppError('INTERNAL_ERROR')
  }

  return renderBilingualEmail({
    ar: {
      heading: 'إعادة تعيين كلمة المرور',
      paragraphs: [
        greeting(args.user, 'ar'),
        'تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك. الرابط صالح لمدة ساعة واحدة.',
        'إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة وستبقى كلمة المرور كما هي.',
      ],
      action: { label: 'تعيين كلمة مرور جديدة', url: pageUrl('ar', 'reset-password', token) },
    },
    en: {
      heading: 'Reset your password',
      paragraphs: [
        greeting(args.user, 'en'),
        'We received a request to reset the password for your account. The link is valid for one hour.',
        'If you did not ask for this, you can ignore this message and your password will stay the same.',
      ],
      action: { label: 'Set a new password', url: pageUrl('en', 'reset-password', token) },
    },
  })
}
