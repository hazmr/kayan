'use client'

import { Direction } from 'radix-ui'
import type { ReactNode } from 'react'

/**
 * The menu and dialog components do not read the page's `dir` attribute by themselves.
 * Without this, Arabic menus line up left-to-right and sub-menus open on the wrong side.
 */
export function DirectionProvider({ dir, children }: { dir: 'rtl' | 'ltr'; children: ReactNode }) {
  return <Direction.DirectionProvider dir={dir}>{children}</Direction.DirectionProvider>
}
