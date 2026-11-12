'use client'

import { useEffect, useRef, type ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  className?: string
  /** Milliseconds to wait before this block appears, so a row of cards arrives one after another. */
  delay?: number
}

/**
 * Fades a block in the first time it scrolls into view.
 *
 * It works on the element directly (no React state) and only hides a block that starts below the
 * screen, so what is already visible on load never flashes. With reduced motion, or before the
 * script runs, the block is simply there.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (element.getBoundingClientRect().top < window.innerHeight) return

    element.dataset.reveal = 'hidden'
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        element.dataset.reveal = 'shown'
        observer.disconnect()
      },
      { threshold: 0.15 },
    )
    // One frame later, so the browser paints the hidden state before it can switch to "shown".
    const frame = requestAnimationFrame(() => observer.observe(element))
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      style={delay > 0 ? ({ '--reveal-delay': `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  )
}
