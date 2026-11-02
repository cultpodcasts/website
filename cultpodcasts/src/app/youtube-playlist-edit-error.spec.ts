import { HttpErrorResponse } from '@angular/common/http';
import {
  YOU_TUBE_PLAYLIST_CHANNEL_MISMATCH,
  YOU_TUBE_PLAYLIST_LOOKUP_FAILED,
  YOU_TUBE_PLAYLIST_NOT_FOUND,
  YOU_TUBE_PLAYLIST_NOT_FOUND_MESSAGE,
  YOU_TUBE_PLAYLIST_OWNER_LOOKUP_FAILED,
  YOU_TUBE_PLAYLIST_OWNER_LOOKUP_FAILED_MESSAGE,
  youtubePlaylistEditError
} from './youtube-playlist-edit-error';

function httpError(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, statusText: 'Error', error: body });
}

describe('youtubePlaylistEditError', () => {
  it('shows the Api message for a channel-mismatch 400 (podcast error field)', () => {
    const message =
      "Playlist PLsynthetic is owned by channel UCsyntheticother; change the playlist or the parent's YouTube channel.";
    expect(
      youtubePlaylistEditError(
        httpError(400, { error: message, code: YOU_TUBE_PLAYLIST_CHANNEL_MISMATCH })
      )
    ).toEqual({ message, retryable: false, code: YOU_TUBE_PLAYLIST_CHANNEL_MISMATCH });
  });

  it('shows the Api message for a channel-mismatch 400 (news/TV message field)', () => {
    const message = 'Playlist owned by another channel; fix the playlist id.';
    expect(
      youtubePlaylistEditError(
        httpError(400, { message, code: YOU_TUBE_PLAYLIST_CHANNEL_MISMATCH })
      )
    ).toEqual({ message, retryable: false, code: YOU_TUBE_PLAYLIST_CHANNEL_MISMATCH });
  });

  it('maps not-found to the fixed curator copy', () => {
    expect(
      youtubePlaylistEditError(
        httpError(400, {
          error: "YouTube playlist 'PLx' was not found (it does not exist or is private).",
          code: YOU_TUBE_PLAYLIST_NOT_FOUND
        })
      )
    ).toEqual({
      message: YOU_TUBE_PLAYLIST_NOT_FOUND_MESSAGE,
      retryable: false,
      code: YOU_TUBE_PLAYLIST_NOT_FOUND
    });
  });

  it('maps owner-lookup-failed and lookup-failed 503s to the retry copy', () => {
    for (const code of [YOU_TUBE_PLAYLIST_OWNER_LOOKUP_FAILED, YOU_TUBE_PLAYLIST_LOOKUP_FAILED]) {
      expect(
        youtubePlaylistEditError(
          httpError(503, { error: 'Could not check', code, retryable: true })
        )
      ).toEqual({
        message: YOU_TUBE_PLAYLIST_OWNER_LOOKUP_FAILED_MESSAGE,
        retryable: true,
        code
      });
      expect(
        youtubePlaylistEditError(
          httpError(503, { message: 'Could not check', code, retryable: true })
        )
      ).toEqual({
        message: YOU_TUBE_PLAYLIST_OWNER_LOOKUP_FAILED_MESSAGE,
        retryable: true,
        code
      });
    }
  });

  it('ignores unrelated failures so callers keep generic save messaging', () => {
    expect(youtubePlaylistEditError(httpError(500, { error: 'boom' }))).toBeUndefined();
    expect(youtubePlaylistEditError(httpError(400, { message: 'bad apple id' }))).toBeUndefined();
    expect(youtubePlaylistEditError(httpError(400, { code: 'somethingElse' }))).toBeUndefined();
    expect(youtubePlaylistEditError(new Error('network'))).toBeUndefined();
  });
});
