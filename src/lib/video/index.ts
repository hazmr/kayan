import { AppError } from '@/lib/errors/AppError'

import { bunnyProvider, isBunnyConfigured } from './bunny'
import type { VideoProvider } from './types'
import { youtubeProvider } from './youtube'

// The only file that knows which video adapters exist.
const providers: Record<VideoProvider['id'], VideoProvider> = {
  youtube: youtubeProvider,
  bunny: bunnyProvider,
}

export function getVideoProvider(id: VideoProvider['id']): VideoProvider {
  const provider = providers[id]
  if (!provider) throw new AppError('NOT_FOUND')
  return provider
}

/** The hosts the lesson form may offer: YouTube always, Bunny once it is set up in .env. */
export function availableVideoProviders(): VideoProvider['id'][] {
  return isBunnyConfigured() ? ['youtube', 'bunny'] : ['youtube']
}
