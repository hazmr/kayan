/**
 * Everything the rest of the app knows about video hosting. Pages and the access check talk to
 * this interface only, so moving a lesson from YouTube to Bunny Stream means one new adapter
 * file and one new line in index.ts.
 *
 * `userId` is optional because guests may watch free previews. A signed-URL adapter (Bunny)
 * will use it to tie the link to the viewer and set `expiresAt`.
 */
export interface VideoProvider {
  id: 'youtube' | 'bunny'
  getPlayback(
    videoId: string,
    ctx: { userId?: string },
  ): Promise<{ embedUrl: string; expiresAt?: Date }>
}
