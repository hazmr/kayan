'use client'

import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

export interface SiteNavItem {
  href: '/courses' | '/my-courses' | '/dashboard'
  label: string
}

/** The links in the middle of the header. The page you are on is underlined. */
export function SiteNav({ items, label }: { items: SiteNavItem[]; label: string }) {
  const pathname = usePathname()

  return (
    <nav aria-label={label} className="flex items-center justify-center gap-6 sm:gap-8">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'border-b-2 py-1 text-sm font-medium transition-colors',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
