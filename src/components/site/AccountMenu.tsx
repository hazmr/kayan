'use client'

import { Languages, LayoutDashboard, LogOut, ReceiptText, UserRound } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'

import type { Role } from '@/access/roles'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { LOCALE_LABELS, LOCALES } from '@/i18n/locales'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { postJson } from '@/lib/api/postJson'

interface AccountMenuProps {
  name: string
  role: Role
  /** Shows the "Dashboard" entry. Off inside the dashboard itself. */
  showDashboard: boolean
  /** Light text on the dark dashboard bar, dark text on the white site header. */
  tone?: 'light' | 'dark'
}

/**
 * Everything about "me" in one place: who is logged in, the dashboard, account settings,
 * the language, and logging out. Used by both the site header and the dashboard top bar.
 */
export function AccountMenu({ name, role, showDashboard, tone = 'dark' }: AccountMenuProps) {
  const t = useTranslations('menu')
  const locale = useLocale()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  function changeLanguage(next: string) {
    const target = LOCALES.find((candidate) => candidate === next)
    if (!target || target === locale) return
    // Same page in the other language, keeping the query string (filters, tokens).
    router.replace(
      { pathname, query: Object.fromEntries(searchParams.entries()) },
      {
        locale: target,
      },
    )
  }

  async function logout() {
    await postJson('/api/users/logout', {})
    router.replace('/')
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('accountMenu')}
        className={cn(
          'flex items-center gap-2 rounded-full py-1 ps-1 pe-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          tone === 'dark' ? 'hover:bg-muted' : 'hover:bg-black/5',
        )}
      >
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
        >
          {name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-40 truncate font-medium sm:inline">{name}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col text-start">
          <span className="truncate font-medium text-foreground">{name}</span>
          <span className="text-xs font-normal text-muted-foreground">{t(`roles.${role}`)}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          {showDashboard && (
            <DropdownMenuItem asChild className="sm:hidden">
              <Link href="/dashboard">
                <LayoutDashboard aria-hidden />
                {t('dashboard')}
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href="/orders">
              <ReceiptText aria-hidden />
              {t('orders')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/account">
              <UserRound aria-hidden />
              {t('account')}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2">
          <Languages aria-hidden className="size-4" />
          {t('language')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={changeLanguage}>
          {LOCALES.map((option) => (
            <DropdownMenuRadioItem key={option} value={option} lang={option}>
              {LOCALE_LABELS[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut aria-hidden className="rtl:rotate-180" />
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
