import type { PayloadRequest } from 'payload'

import { env } from '@/lib/env'
import type { User } from '@/payload-types'

import { bilingualSubject, renderBilingualEmail } from './layout'

function confirmUrl(locale: 'ar' | 'en', token: string): string {
  return `${env.siteUrl}/${locale}/dashboard/confirm-owner?token=${encodeURIComponent(token)}`
}

/** Sent to the owner who asked to make someone else an owner. Nothing happens until they confirm. */
export async function sendOwnerConfirmEmail(
  { to, target, token }: { to: User; target: User; token: string },
  req: PayloadRequest,
): Promise<void> {
  const html = renderBilingualEmail({
    ar: {
      heading: 'تأكيد إضافة مالك جديد للمنصة',
      paragraphs: [
        `طلبت منح صلاحية «مالك المنصة» إلى ${target.name} (${target.email}).`,
        'لن يتم التغيير إلا بعد فتح الرابط التالي وأنت مسجّل الدخول، ثم الضغط على «تأكيد». الرابط صالح لمدة 30 دقيقة ولمرة واحدة.',
        'إذا لم تطلب ذلك، تجاهل هذه الرسالة وغيّر كلمة المرور الخاصة بك.',
      ],
      action: { label: 'مراجعة الطلب', url: confirmUrl('ar', token) },
    },
    en: {
      heading: 'Confirm a new platform owner',
      paragraphs: [
        `You asked to make ${target.name} (${target.email}) an owner of the platform.`,
        'Nothing changes until you open this link while logged in and press Confirm. The link works once, for 30 minutes.',
        'If you did not ask for this, ignore this message and change your password.',
      ],
      action: { label: 'Review the request', url: confirmUrl('en', token) },
    },
  })

  // Unlike notices, this email is the only way to finish, so a failure is reported to the owner.
  await req.payload.sendEmail({
    to: to.email,
    subject: bilingualSubject('تأكيد إضافة مالك للمنصة', 'Confirm a new owner'),
    html,
  })
}
