'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { LOCALE_LABELS, LOCALES } from '@/i18n/locales'
import { Link, usePathname } from '@/i18n/navigation'

/** With two languages, one button that opens the same page in the other language is enough. */
export function LocaleSwitcher() {
  const t = useTranslations('nav')
  const locale = useLocale()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const other = LOCALES.find((candidate) => candidate !== locale) ?? locale
  // Keep the query string, so a link with ?token=... still works after switching.
  const query = Object.fromEntries(searchParams.entries())

  return (
    <Button asChild variant="ghost" size="sm">
      <Link href={{ pathname, query }} locale={other} aria-label={t('switchLanguage')} lang={other}>
        {LOCALE_LABELS[other]}
      </Link>
    </Button>
  )
}
