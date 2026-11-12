import { getFormatter } from 'next-intl/server'

/** Formats whole piasters as EGP in the current language (a function, so a page can call it many times). */
export async function getMoneyFormatter() {
  const format = await getFormatter()
  return (piasters: number) =>
    format.number(piasters / 100, {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
}

/** One number with a label: the building block of every overview. */
export function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string
  value: string
  tone?: 'good' | 'bad'
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={
          'text-2xl font-bold ' +
          (tone === 'bad' ? 'text-destructive' : tone === 'good' ? 'text-primary' : '')
        }
      >
        {value}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}
