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
