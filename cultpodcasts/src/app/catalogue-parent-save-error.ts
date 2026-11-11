import { HttpErrorResponse } from '@angular/common/http';

/** RPP #1370 news organisation PATCH refusals (400) for `additionalYouTubeChannelIds`. */
export const INVALID_ADDITIONAL_YOU_TUBE_CHANNEL_ID = 'invalidAdditionalYouTubeChannelId';
export const ADDITIONAL_YOU_TUBE_CHANNEL_IS_MAIN_CHANNEL = 'additionalYouTubeChannelIsMainChannel';
/** Another parent or podcast already claims the channel channel-wide (400, any YouTube channel edit). */
export const CHANNEL_WIDE_YOU_TUBE_CONFLICT = 'channelWideYouTubeConflict';

const NOTHING_CHANGED = 'Nothing was changed.';

const channelCodes = new Set([
  INVALID_ADDITIONAL_YOU_TUBE_CHANNEL_ID,
  ADDITIONAL_YOU_TUBE_CHANNEL_IS_MAIN_CHANNEL,
  CHANNEL_WIDE_YOU_TUBE_CONFLICT
]);

function withNothingChanged(message: string): string {
  const trimmed = message.trim();
  return /[.!?]$/.test(trimmed) ? `${trimmed} ${NOTHING_CHANGED}` : `${trimmed}. ${NOTHING_CHANGED}`;
}

/**
 * Curator copy for a news outlet / TV show save refused because of its YouTube channels or service ids:
 * the API's 400 channel codes, and a 409 when an id (main or additional channel, Spotify, Apple) is already
 * owned elsewhere (`{ message, ids }`). Shows the API message so the curator sees which id and owner.
 * Returns undefined for other failures so the dialog keeps its generic copy.
 */
export function catalogueParentSaveError(error: unknown): string | undefined {
  if (!(error instanceof HttpErrorResponse) || !error.error || typeof error.error !== 'object') {
    return undefined;
  }
  const body = error.error as Record<string, unknown>;
  const message = typeof body['message'] === 'string' ? body['message'].trim() : '';
  if (!message) {
    return undefined;
  }
  if (error.status === 400 && typeof body['code'] === 'string' && channelCodes.has(body['code'])) {
    return withNothingChanged(message);
  }
  if (error.status === 409) {
    return withNothingChanged(`Already used by another news outlet, TV show or podcast: ${message}`);
  }
  return undefined;
}
