'use client'

import { Languages } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { LOCALE_LABELS, LOCALES } from '@/i18n/locales'
import { Link, usePathname } from '@/i18n/navigation'

/** For visitors who are not logged in. Logged-in people find the language in their account menu. */
export function LocaleSwitcher() {
  const t = useTranslations('nav')
  const locale = useLocale()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const other = LOCALES.find((candidate) => candidate !== locale) ?? locale
  // Keep the query string, so a link with ?token=... still works after switching.
  const query = Object.fromEntries(searchParams.entries())

  return (
    <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
      {/* The visible text is the language's own name, which is the clearest label for it. */}
      <Link href={{ pathname, query }} locale={other} lang={other} title={t('switchLanguage')}>
        <Languages aria-hidden />
        {/* Icon only on phones, where the header is tight; the name stays for screen readers. */}
        <span className="sr-only sm:not-sr-only">{LOCALE_LABELS[other]}</span>
      </Link>
    </Button>
  )
}
