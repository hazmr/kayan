import { AppError } from '@/lib/errors/AppError'

import type { VideoProvider } from './types'
import { youtubeProvider } from './youtube'

// The only file that knows which video adapters exist.
const providers: Partial<Record<VideoProvider['id'], VideoProvider>> = {
  youtube: youtubeProvider,
  // bunny: bunnyProvider,   <- adding Bunny later is this line plus its adapter file
}

export function getVideoProvider(id: VideoProvider['id']): VideoProvider {
  const provider = providers[id]
  if (!provider) throw new AppError('NOT_FOUND')
  return provider
}
