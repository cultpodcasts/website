import { DiscoveryResult } from './discovery-result.interface';

/** Show identity used to hide every card from a channel the curator just banned. */
export interface BannedChannel {
  resultId: string;
  podcastId?: string | null;
  showName?: string | null;
  youTubeChannelId?: string | null;
  spotifyId?: string | null;
  appleId?: number | null;
}

export function isSameBannedChannel(result: DiscoveryResult, banned: BannedChannel): boolean {
  if (result.id === banned.resultId) {
    return true;
  }
  if (banned.podcastId && result.matchingPodcasts?.some(podcast => podcast.id === banned.podcastId)) {
    return true;
  }
  if (sameId(result.youTubeChannelId, banned.youTubeChannelId)
    || sameId(result.spotifyId, banned.spotifyId)
    || (banned.appleId != null && result.appleId != null && result.appleId === banned.appleId)) {
    return true;
  }
  if (contradicts(result, banned)) {
    return false;
  }
  return sameShowName(result.showName, banned.showName);
}

export function bannedResultIds(results: readonly DiscoveryResult[], banned: BannedChannel): string[] {
  return results.filter(result => isSameBannedChannel(result, banned)).map(result => result.id);
}

export function matchesBannedChannel(result: DiscoveryResult, channels: readonly BannedChannel[]): boolean {
  return channels.some(channel => isSameBannedChannel(result, channel));
}

/** Ids still safe to send on Save after channels banned in this visit. */
export function saveResultIds(
  results: readonly DiscoveryResult[],
  selectedIds: readonly string[],
  channels: readonly BannedChannel[]
): string[] {
  return selectedIds.filter(id => {
    const result = results.find(item => item.id === id);
    return !!result && !matchesBannedChannel(result, channels);
  });
}

/**
 * Snackbar text for a refused ban or a follow-up read that failed.
 * The ban POST is `responseType: 'text'`, so a refusal body is a JSON string.
 * A later GET may already have parsed `{ error }`. A thrown `Error` has only `message`.
 */
export function banFailureMessage(failure: unknown): string {
  const fallback = 'Could not remove the podcast';
  const fromBody = messageFromBody(bodyOf(failure));
  if (fromBody) {
    return fromBody;
  }
  if (failure instanceof Error && failure.message && !failure.message.startsWith('Http failure response')) {
    return failure.message;
  }
  return fallback;
}

function bodyOf(failure: unknown): unknown {
  if (failure && typeof failure === 'object' && 'error' in failure) {
    return (failure as { error?: unknown }).error;
  }
  return undefined;
}

function messageFromBody(body: unknown): string | undefined {
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (!trimmed) {
      return undefined;
    }
    try {
      return messageFromBody(JSON.parse(trimmed) as unknown);
    } catch {
      return undefined;
    }
  }
  if (body && typeof body === 'object' && 'error' in body && typeof (body as { error?: unknown }).error === 'string') {
    const text = (body as { error: string }).error.trim();
    return text || undefined;
  }
  return undefined;
}

function sameId(left: string | null | undefined, right: string | null | undefined): boolean {
  return !!left && !!right && left === right;
}

function sameShowName(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = left?.trim();
  const b = right?.trim();
  return !!a && !!b && a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;
}

function contradicts(result: DiscoveryResult, banned: BannedChannel): boolean {
  if (banned.youTubeChannelId && result.youTubeChannelId && result.youTubeChannelId !== banned.youTubeChannelId) {
    return true;
  }
  if (banned.spotifyId && result.spotifyId && result.spotifyId !== banned.spotifyId) {
    return true;
  }
  return banned.appleId != null && result.appleId != null && result.appleId !== banned.appleId;
}
