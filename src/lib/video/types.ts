/**
 * Everything the rest of the app knows about video hosting. Pages and the access check talk to
 * this interface only, so moving a lesson from YouTube to Bunny Stream means one new adapter
 * file and one new line in index.ts.
 *
 * `userId` is optional because guests may watch free previews. The signed-URL adapter (Bunny)
 * returns `expiresAt`: its links stop working after a few hours.
 */
export interface VideoProvider {
  id: 'youtube' | 'bunny'
  getPlayback(
    videoId: string,
    ctx: { userId?: string },
    /** The current time; tests pass a fixed one. */
    now?: Date,
  ): Promise<{ embedUrl: string; expiresAt?: Date }>
}
