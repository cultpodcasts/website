import { EpisodeChangeResponse } from './episode-change-response.interface';
import { EditEpisodeDialogResponse } from './edit-episode-dialog-response.interface';

/** True when the API reported a social delete was requested but did not succeed. */
export function socialRetractFailed(
  response?: Pick<EpisodeChangeResponse, 'tweetDeleted' | 'blueskyPostDeleted'> | null
): boolean {
  return response?.tweetDeleted === false || response?.blueskyPostDeleted === false;
}

/**
 * Curator-facing snack when tweet/Bluesky delete failed and the posted flag was left set.
 * Null when there was no retract failure.
 */
export function socialRetractFailureMessage(
  response?: Pick<EpisodeChangeResponse, 'tweetDeleted' | 'blueskyPostDeleted'> | null
): string | null {
  if (!response) {
    return null;
  }
  const blueskyFailed = response.blueskyPostDeleted === false;
  const tweetFailed = response.tweetDeleted === false;
  if (blueskyFailed && tweetFailed) {
    return 'Could not delete Bluesky post or tweet — posted flags left unchanged';
  }
  if (blueskyFailed) {
    return 'Could not delete Bluesky post — Bluesky posted flag left unchanged';
  }
  if (tweetFailed) {
    return 'Could not delete tweet — Tweeted flag left unchanged';
  }
  return null;
}

/** Review / bookmarks snack after Edit Episode closes. */
export function episodeEditResultMessage(
  result: EditEpisodeDialogResponse | null | undefined
): string | null {
  if (result?.updated) {
    return socialRetractFailureMessage(result.response) ?? 'Episode updated';
  }
  if (result?.noChange) {
    return 'No change';
  }
  return null;
}
