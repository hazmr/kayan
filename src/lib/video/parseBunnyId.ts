/** Bunny video ids are GUIDs, for example 2f1e6c3a-9b0d-4c77-8a1e-5d2b9f6e4a10. */
export const BUNNY_VIDEO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const GUID_ANYWHERE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/**
 * People paste whatever Bunny shows them: the video id, or a player or dashboard link that
 * contains it. Returns the video id (the last GUID in the text, since a link puts the library
 * first and the video last), or null when there is none.
 */
export function parseBunnyId(input: string): string | null {
  const found = input.trim().match(GUID_ANYWHERE)
  return found ? (found[found.length - 1] ?? null).toLowerCase() : null
}
