'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useRouter } from '@/i18n/navigation'
import { postJson } from '@/lib/api/postJson'

export function LogoutButton() {
  const t = useTranslations('nav')
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleClick() {
    setPending(true)
    await postJson('/api/users/logout', {})
    router.replace('/')
    // Re-render the server parts of the page (the header) without the user.
    router.refresh()
    setPending(false)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={pending}>
      {t('logout')}
    </Button>
  )
}
