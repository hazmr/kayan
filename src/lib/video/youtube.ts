import { AppError } from '@/lib/errors/AppError'

import type { VideoProvider } from './types'

const VIDEO_ID = /^[A-Za-z0-9_-]{6,}$/

/**
 * YouTube (unlisted) for development and early testing. Anyone who is allowed to watch can
 * copy the link out of the page and share it, so this is NOT protection for paid content:
 * the plan is Bunny Stream with signed, expiring links before real students pay.
 */
export const youtubeProvider: VideoProvider = {
  id: 'youtube',
  async getPlayback(videoId) {
    // The id goes into a URL, so it is checked again here even though it was checked when saved.
    if (!VIDEO_ID.test(videoId)) throw new AppError('NOT_FOUND')
    // youtube-nocookie.com: no tracking cookies until the viewer presses play.
    return {
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`,
    }
  },
}
