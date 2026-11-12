import { describe, expect, it } from 'vitest'

import { createHash } from 'node:crypto'

import { availableVideoProviders, getVideoProvider } from '@/lib/video'
import { BUNNY_LINK_LIFETIME_SECONDS, bunnyProvider, signBunnyEmbed } from '@/lib/video/bunny'
import { parseBunnyId } from '@/lib/video/parseBunnyId'
import { youtubeProvider } from '@/lib/video/youtube'

describe('YouTube video adapter', () => {
  it('builds a privacy-friendly embed URL from a video id', async () => {
    const { embedUrl, expiresAt } = await youtubeProvider.getPlayback('dQw4w9WgXcQ', {})
    expect(embedUrl.startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?')).toBe(true)
    expect(embedUrl).toContain('rel=0')
    expect(expiresAt).toBeUndefined() // YouTube links do not expire; Bunny's signed links do
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

  it('returns the Bunny adapter, and offers Bunny in the lesson form once it is set up', () => {
    expect(getVideoProvider('bunny')).toBe(bunnyProvider)
    // The test settings include a Bunny library and key (tests/support/env.ts).
    expect(availableVideoProviders()).toEqual(['youtube', 'bunny'])
  })
})

const VIDEO = '2f1e6c3a-9b0d-4c77-8a1e-5d2b9f6e4a10'

describe('Bunny signed links', () => {
  it('signs exactly as Bunny documents: SHA256_HEX(token key + video id + expires)', () => {
    const url = new URL(
      signBunnyEmbed({
        libraryId: '759',
        tokenKey: 'secret-key',
        videoId: VIDEO,
        expires: 1_900_000_000,
      }),
    )
    expect(url.origin + url.pathname).toBe(`https://player.mediadelivery.net/embed/759/${VIDEO}`)
    expect(url.searchParams.get('expires')).toBe('1900000000')
    const expected = createHash('sha256').update(`secret-key${VIDEO}1900000000`).digest('hex')
    expect(url.searchParams.get('token')).toBe(expected)
  })

  it('a different key, video, or time gives a different token (a copied link cannot be bent)', () => {
    const token = (args: Partial<Parameters<typeof signBunnyEmbed>[0]>) =>
      new URL(
        signBunnyEmbed({ libraryId: '1', tokenKey: 'k', videoId: VIDEO, expires: 100, ...args }),
      ).searchParams.get('token')
    const base = token({})
    expect(token({ tokenKey: 'other' })).not.toBe(base)
    expect(token({ videoId: VIDEO.replace('2f', '3f') })).not.toBe(base)
    expect(token({ expires: 101 })).not.toBe(base)
  })

  it('a playback link expires a few hours after it is made', async () => {
    const now = new Date('2026-11-12T10:00:00Z')
    const { embedUrl, expiresAt } = await bunnyProvider.getPlayback(VIDEO, { userId: 'u1' }, now)
    expect(expiresAt?.getTime()).toBe(now.getTime() + BUNNY_LINK_LIFETIME_SECONDS * 1000)
    expect(new URL(embedUrl).searchParams.get('expires')).toBe(
      String(Math.floor(now.getTime() / 1000) + BUNNY_LINK_LIFETIME_SECONDS),
    )
  })

  it.each([
    ['empty', ''],
    ['a YouTube id', 'dQw4w9WgXcQ'],
    ['an injection attempt', `${VIDEO}?x=1`],
  ])('refuses %s', async (_name, videoId) => {
    await expect(bunnyProvider.getPlayback(videoId, {})).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})

describe('parseBunnyId', () => {
  it('accepts the id itself, or any Bunny link that contains it (the video comes last)', () => {
    expect(parseBunnyId(VIDEO)).toBe(VIDEO)
    expect(parseBunnyId(`  ${VIDEO.toUpperCase()}  `)).toBe(VIDEO)
    expect(parseBunnyId(`https://player.mediadelivery.net/embed/759/${VIDEO}`)).toBe(VIDEO)
    expect(
      parseBunnyId(
        `https://dash.bunny.net/stream/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/library/videos?videoId=${VIDEO}`,
      ),
    ).toBe(VIDEO)
  })

  it('returns null when there is no Bunny id', () => {
    expect(parseBunnyId('')).toBeNull()
    expect(parseBunnyId('https://youtu.be/dQw4w9WgXcQ')).toBeNull()
  })
})
