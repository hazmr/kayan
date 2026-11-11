'use client'

import {
  CreditCard,
  Receipt,
  FolderTree,
  LayoutList,
  Settings,
  Undo2,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { Link, usePathname } from '@/i18n/navigation'

const ICONS = {
  courses: LayoutList,
  orders: Receipt,
  payments: CreditCard,
  refunds: Undo2,
  categories: FolderTree,
  users: Users,
  settings: Settings,
} satisfies Record<string, LucideIcon>

export interface NavItem {
  href: string
  label: string
  icon: keyof typeof ICONS
  badge?: string
}

export function DashboardNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname()

  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto md:flex-col">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        const Icon = ICONS[item.icon]
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors ' +
              (active
                ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground')
            }
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span className="rounded-full bg-sidebar-primary px-2 py-0.5 text-xs font-semibold text-sidebar-primary-foreground">
                {item.badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
