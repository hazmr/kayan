import { createHash } from 'node:crypto'

import { env } from '@/lib/env'
import { AppError } from '@/lib/errors/AppError'

import { BUNNY_VIDEO_ID } from './parseBunnyId'
import type { VideoProvider } from './types'

export { BUNNY_VIDEO_ID }

/**
 * How long a signed player link works. The link only has to open the player; a few hours
 * covers a long lesson with pauses, and a copied link is useless by the next day.
 */
export const BUNNY_LINK_LIFETIME_SECONDS = 4 * 60 * 60

/**
 * Bunny's embed view token: SHA256_HEX(token key + video id + expires), with `expires` a UNIX
 * time in seconds. Bunny refuses the player when the link is changed or out of date.
 * https://bunny.net/docs/stream/token-authentication
 */
export function signBunnyEmbed(args: {
  libraryId: string
  tokenKey: string
  videoId: string
  /** UNIX time in seconds. */
  expires: number
}): string {
  const token = createHash('sha256')
    .update(args.tokenKey + args.videoId + String(args.expires))
    .digest('hex')
  const query = new URLSearchParams({ token, expires: String(args.expires) })
  return `https://player.mediadelivery.net/embed/${encodeURIComponent(args.libraryId)}/${args.videoId}?${query}`
}

/** Bunny is usable only when the library and its signing key are set in .env. */
export function isBunnyConfigured(): boolean {
  return Boolean(env.bunny.libraryId && env.bunny.tokenKey)
}

/**
 * Bunny Stream for paid and exclusive lessons. The library must have token authentication
 * (and, for download protection, MediaCage DRM) switched on in Bunny's dashboard, and the
 * site's domain allowed; then a link works only for a few hours and only as built here.
 */
export const bunnyProvider: VideoProvider = {
  id: 'bunny',
  async getPlayback(videoId, _ctx, now = new Date()) {
    const { libraryId, tokenKey } = env.bunny
    if (!libraryId || !tokenKey) throw new AppError('NOT_FOUND')
    if (!BUNNY_VIDEO_ID.test(videoId)) throw new AppError('NOT_FOUND')
    const expires = Math.floor(now.getTime() / 1000) + BUNNY_LINK_LIFETIME_SECONDS
    return {
      embedUrl: signBunnyEmbed({ libraryId, tokenKey, videoId, expires }),
      expiresAt: new Date(expires * 1000),
    }
  },
}

/**
 * The video's length in seconds, read from Bunny's API, or null when it cannot be read (no
 * API key, not processed yet, network trouble). Used to fill in a lesson's length on save.
 */
export async function fetchBunnyLength(videoId: string): Promise<number | null> {
  const { libraryId, apiKey } = env.bunny
  if (!libraryId || !apiKey || !BUNNY_VIDEO_ID.test(videoId)) return null
  try {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${encodeURIComponent(libraryId)}/videos/${videoId}`,
      {
        headers: { AccessKey: apiKey, accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      },
    )
    if (!response.ok) return null
    const body: unknown = await response.json()
    const length =
      typeof body === 'object' && body !== null ? (body as { length?: unknown }).length : null
    return typeof length === 'number' && Number.isFinite(length) && length > 0
      ? Math.round(length)
      : null
  } catch {
    return null
  }
}
