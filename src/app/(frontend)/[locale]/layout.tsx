import type { Metadata } from 'next'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { Cairo } from 'next/font/google'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { DirectionProvider } from '@/components/site/DirectionProvider'
import { directionOf } from '@/i18n/locales'
import { routing } from '@/i18n/routing'
import { siteName } from '@/lib/site'

import '../globals.css'

// Cairo covers Arabic and Latin, so both languages share one typeface.
const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-sans',
  display: 'swap',
})

interface LayoutProps {
  children: ReactNode
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'meta' })
  return { title: `${siteName(locale)} | ${t('title')}`, description: t('description') }
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  return (
    // `dir` is what flips the whole page for Arabic. Components use logical CSS
    // (start/end instead of left/right), so they follow it without extra code.
    <html lang={locale} dir={directionOf(locale)} className={cairo.variable}>
      <body className="min-h-dvh antialiased">
        {/* The public site and the dashboard each add their own frame in their layouts. */}
        <NextIntlClientProvider>
          <DirectionProvider dir={directionOf(locale)}>{children}</DirectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
