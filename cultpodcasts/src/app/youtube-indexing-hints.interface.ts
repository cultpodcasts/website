/**
 * Indexer-owned YouTube playlist walk hints (RPP / website #541).
 * Read-only on curator GET; clear with PATCH `clearYouTubeIndexingHints: true`.
 * Dates arrive as `Date` after `JsonDateInterceptor`.
 */
export interface YouTubeIndexingHints {
  playlistId?: string | null;
  lastFullWalk?: Date | string | null;
  playlistItemCount?: number | null;
  uploadsCheckedThrough?: Date | string | null;
  uploadsCheckedThroughVideoId?: string | null;
}
