const ID_PATTERN = /^[A-Za-z0-9_-]{6,}$/

/**
 * Doctors paste whatever they copied: a full link, a short link, or just the id.
 * Returns the video id, or null when the text is none of those.
 *
 *   https://www.youtube.com/watch?v=abc123XYZ_-  ->  abc123XYZ_-
 *   https://youtu.be/abc123XYZ_-?t=10            ->  abc123XYZ_-
 *   abc123XYZ_-                                   ->  abc123XYZ_-
 */
export function parseYouTubeId(input: string): string | null {
  const text = input.trim()
  if (ID_PATTERN.test(text)) return text

  let url: URL
  try {
    url = new URL(text)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\.|^m\./, '')
  let candidate: string | null = null
  if (host === 'youtu.be') {
    candidate = url.pathname.split('/')[1] ?? null
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [, first, second] = url.pathname.split('/')
    candidate = first === 'watch' ? url.searchParams.get('v') : (second ?? null)
    if (first !== 'watch' && first !== 'embed' && first !== 'shorts' && first !== 'live') {
      candidate = null
    }
  }
  return candidate && ID_PATTERN.test(candidate) ? candidate : null
}
