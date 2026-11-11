import { getFormatter, getTranslations } from 'next-intl/server'

/** "Free" for 0, otherwise the price in pounds formatted for the current language. */
export async function CoursePrice({
  priceEgp,
  className,
}: {
  priceEgp: number
  className?: string
}) {
  const [t, format] = await Promise.all([getTranslations('courses'), getFormatter()])

  return (
    <span className={className}>
      {priceEgp === 0
        ? t('free')
        : format.number(priceEgp, { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 })}
    </span>
  )
}
