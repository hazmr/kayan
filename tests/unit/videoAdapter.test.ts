import { describe, expect, it } from 'vitest'

import { getVideoProvider } from '@/lib/video'
import { youtubeProvider } from '@/lib/video/youtube'

describe('YouTube video adapter', () => {
  it('builds a privacy-friendly embed URL from a video id', async () => {
    const { embedUrl, expiresAt } = await youtubeProvider.getPlayback('dQw4w9WgXcQ', {})
    expect(embedUrl.startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?')).toBe(true)
    expect(embedUrl).toContain('rel=0')
    expect(expiresAt).toBeUndefined() // YouTube links do not expire; Bunny's signed links will
  })

  it('works for guests (free previews): the user id is optional', async () => {
    await expect(youtubeProvider.getPlayback('dQw4w9WgXcQ', {})).resolves.toBeTruthy()
    await expect(youtubeProvider.getPlayback('dQw4w9WgXcQ', { userId: 'u1' })).resolves.toBeTruthy()
  })

  it.each([
    ['empty', ''],
    ['too short', 'abc'],
    ['a full link instead of an id', 'https://youtu.be/dQw4w9WgXcQ'],
    ['a quote that could break out of the URL', 'abcdefg"onload="alert(1)'],
    ['a path', '../../etc/passwd'],
    ['spaces', 'abc def ghi'],
    ['a query string', 'dQw4w9WgXcQ?autoplay=1'],
  ])('refuses %s', async (_label, videoId) => {
    await expect(youtubeProvider.getPlayback(videoId, {})).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('accepts the characters a real id can contain', async () => {
    await expect(youtubeProvider.getPlayback('a-B_c1D2e3F', {})).resolves.toBeTruthy()
  })
})

describe('video provider registry', () => {
  it('returns the YouTube adapter', () => {
    expect(getVideoProvider('youtube')).toBe(youtubeProvider)
    expect(youtubeProvider.id).toBe('youtube')
  })

  it('has no Bunny adapter yet (adding it is one new file and one line)', () => {
    expect(() => getVideoProvider('bunny')).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }))
  })
})
