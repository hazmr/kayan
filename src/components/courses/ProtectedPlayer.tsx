'use client'

import { Maximize, Minimize } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

/** Where the watermark may sit, as percentages of the player. It moves between these. */
const SPOTS = [
  { top: 8, left: 6 },
  { top: 12, left: 58 },
  { top: 44, left: 30 },
  { top: 70, left: 8 },
  { top: 74, left: 55 },
  { top: 38, left: 64 },
]
const MOVE_EVERY_MS = 12_000

/**
 * The player for paid, protected videos (Bunny Stream).
 *
 * - The viewer's own name and phone drift slowly across the video. Bunny's DRM stops download
 *   tools; nothing can stop someone filming their screen, so this makes any leaked recording
 *   point back to the account that made it.
 * - Full screen goes through our own button, on the box that holds BOTH the video and the
 *   watermark. (The player's own full-screen button is turned off: it would show the video
 *   without the watermark.)
 */
export function ProtectedPlayer({
  embedUrl,
  title,
  watermark,
}: {
  embedUrl: string
  title: string
  watermark: string
}) {
  const t = useTranslations('watch')
  const box = useRef<HTMLDivElement>(null)
  const [spot, setSpot] = useState(0)
  const [fullScreen, setFullScreen] = useState(false)

  useEffect(() => {
    const timer = setInterval(
      () => setSpot((current) => (current + 1) % SPOTS.length),
      MOVE_EVERY_MS,
    )
    const onChange = () => setFullScreen(document.fullscreenElement === box.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      clearInterval(timer)
      document.removeEventListener('fullscreenchange', onChange)
    }
  }, [])

  function toggleFullScreen() {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void box.current?.requestFullscreen()
  }

  const position = SPOTS[spot] ?? SPOTS[0]!

  return (
    <div
      ref={box}
      className="relative aspect-video overflow-hidden rounded-xl border bg-black [&:fullscreen]:rounded-none [&:fullscreen]:border-0"
      onContextMenu={(event) => event.preventDefault()}
    >
      <iframe
        src={embedUrl}
        title={title}
        className="size-full"
        // No "fullscreen" here on purpose: see the comment above.
        allow="accelerometer; gyroscope; encrypted-media; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute text-xs font-medium whitespace-nowrap text-white/45 drop-shadow transition-all duration-[2000ms] select-none sm:text-sm"
        style={{ top: `${position.top}%`, left: `${position.left}%` }}
      >
        {watermark}
      </span>
      <button
        type="button"
        onClick={toggleFullScreen}
        className="absolute end-2 top-2 flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-xs text-white hover:bg-black/75"
      >
        {fullScreen ? (
          <Minimize className="size-3.5" aria-hidden />
        ) : (
          <Maximize className="size-3.5" aria-hidden />
        )}
        {fullScreen ? t('exitFullScreen') : t('fullScreen')}
      </button>
    </div>
  )
}
