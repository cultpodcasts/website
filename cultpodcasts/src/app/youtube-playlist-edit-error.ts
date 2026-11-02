import { HttpErrorResponse } from '@angular/common/http';

/** Api refuse codes when a parent YouTube playlist id cannot be saved (RPP playlist guard / website #575). */
export const YOU_TUBE_PLAYLIST_CHANNEL_MISMATCH = 'youTubePlaylistChannelMismatch';
export const YOU_TUBE_PLAYLIST_NOT_FOUND = 'youTubePlaylistNotFound';
/** Issue #575 name; Api may still send this. */
export const YOU_TUBE_PLAYLIST_OWNER_LOOKUP_FAILED = 'youTubePlaylistOwnerLookupFailed';
/** Current Api code for a retryable YouTube lookup failure. */
export const YOU_TUBE_PLAYLIST_LOOKUP_FAILED = 'youTubePlaylistLookupFailed';

export const YOU_TUBE_PLAYLIST_NOT_FOUND_MESSAGE =
  'YouTube playlist not found (missing or private)';
export const YOU_TUBE_PLAYLIST_OWNER_LOOKUP_FAILED_MESSAGE =
  "Couldn't check who owns the playlist; nothing was saved, try again";

export interface YouTubePlaylistEditError {
  message: string;
  retryable: boolean;
  code: string;
}

function bodyText(body: Record<string, unknown>): string | undefined {
  // Podcast handler: ApiErrorResponse.error; news org / TV show: message.
  for (const key of ['error', 'message'] as const) {
    const value = body[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function bodyCode(body: Record<string, unknown>): string | undefined {
  const code = body['code'];
  return typeof code === 'string' && code.trim() ? code : undefined;
}

/**
 * Maps playlist-ownership Api errors to curator copy. Returns undefined for unrelated failures
 * so callers keep their generic save messaging.
 */
export function youtubePlaylistEditError(error: unknown): YouTubePlaylistEditError | undefined {
  if (!(error instanceof HttpErrorResponse)) {
    return undefined;
  }
  const raw = error.error;
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const body = raw as Record<string, unknown>;
  const code = bodyCode(body);
  if (!code) {
    return undefined;
  }

  switch (code) {
    case YOU_TUBE_PLAYLIST_CHANNEL_MISMATCH: {
      const message = bodyText(body);
      if (!message) {
        return undefined;
      }
      return { message, retryable: false, code };
    }
    case YOU_TUBE_PLAYLIST_NOT_FOUND:
      return {
        message: YOU_TUBE_PLAYLIST_NOT_FOUND_MESSAGE,
        retryable: false,
        code
      };
    case YOU_TUBE_PLAYLIST_OWNER_LOOKUP_FAILED:
    case YOU_TUBE_PLAYLIST_LOOKUP_FAILED:
      return {
        message: YOU_TUBE_PLAYLIST_OWNER_LOOKUP_FAILED_MESSAGE,
        retryable: true,
        code
      };
    default:
      return undefined;
  }
}
