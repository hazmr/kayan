import type { PayloadRequest } from 'payload'

import type { Role } from '@/access/roles'
import { env } from '@/lib/env'

import { bilingualSubject, renderBilingualEmail } from './layout'

const ROLE_NAMES: Record<Role, { ar: string; en: string }> = {
  superadmin: { ar: 'مالك المنصة', en: 'Owner' },
  manager: { ar: 'مدير', en: 'Manager' },
  admin: { ar: 'طبيب', en: 'Doctor' },
  student: { ar: 'طالب', en: 'Student' },
}

interface RoleChange {
  person: { name: string; email: string }
  from: Role
  to: Role
  changedBy: { name: string; email: string }
}

/**
 * Tells the person whose role changed, and every owner, so a mistaken change is noticed at once.
 * Sent after the change is saved. A failed email is logged and never undoes the change.
 */
export async function sendRoleChangedEmails(
  change: RoleChange,
  ownerEmails: string[],
  req: PayloadRequest,
): Promise<void> {
  const { person, from, to, changedBy } = change
  const html = renderBilingualEmail({
    ar: {
      heading: 'تم تغيير صلاحية حساب',
      paragraphs: [
        `تم تغيير صلاحية ${person.name} (${person.email}) من «${ROLE_NAMES[from].ar}» إلى «${ROLE_NAMES[to].ar}».`,
        `قام بالتغيير: ${changedBy.name} (${changedBy.email}).`,
        'إذا لم يكن هذا التغيير مقصوداً، تواصل مع مالك المنصة فوراً.',
      ],
      action: { label: 'فتح لوحة التحكم', url: `${env.siteUrl}/ar/dashboard/users` },
    },
    en: {
      heading: 'An account role was changed',
      paragraphs: [
        `${person.name} (${person.email}) was changed from "${ROLE_NAMES[from].en}" to "${ROLE_NAMES[to].en}".`,
        `Changed by: ${changedBy.name} (${changedBy.email}).`,
        'If this change was not intended, contact the platform owner right away.',
      ],
      action: { label: 'Open the dashboard', url: `${env.siteUrl}/en/dashboard/users` },
    },
  })
  const subject = bilingualSubject('تغيير صلاحية حساب', 'Account role changed')
  const recipients = [...new Set([person.email, ...ownerEmails])]

  await Promise.all(
    recipients.map((to) =>
      req.payload.sendEmail({ to, subject, html }).catch((error: unknown) => {
        req.payload.logger.error({ err: error, msg: 'Role change email failed' })
      }),
    ),
  )
}
