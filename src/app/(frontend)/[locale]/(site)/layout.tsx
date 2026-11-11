import type { ReactNode } from 'react'

import { SiteHeader } from '@/components/site/SiteHeader'

// The public site's frame: header on top, page below. The dashboard has its own frame.
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
    </>
  )
}
