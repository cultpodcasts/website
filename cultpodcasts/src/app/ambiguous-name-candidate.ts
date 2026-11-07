import { CatalogueParentDto } from './catalogue-parent.interface';
import { Podcast } from './podcast.interface';

/** Distinguishing fields for a 409 same-name picker (podcast, news outlet, or TV show). */
export interface AmbiguousNameCandidate {
  id: string;
  name?: string | null;
  spotifyId?: string | null;
  appleId?: number | null;
  youTubeChannelId?: string | null;
  youTubePlaylistId?: string | null;
  twitterHandle?: string | null;
  blueskyHandle?: string | null;
  removed?: boolean | null;
}

export function ambiguousCandidateFromPodcast(podcast: Podcast): AmbiguousNameCandidate {
  return {
    id: podcast.id ?? '',
    name: podcast.name,
    spotifyId: podcast.spotifyId,
    appleId: podcast.appleId,
    youTubeChannelId: podcast.youTubeChannelId,
    youTubePlaylistId: podcast.youTubePlaylistId,
    twitterHandle: podcast.twitterHandle,
    blueskyHandle: podcast.blueskyHandle,
    removed: podcast.removed
  };
}

export function ambiguousCandidateFromCatalogueParent(parent: CatalogueParentDto): AmbiguousNameCandidate {
  return {
    id: parent.id,
    name: parent.name,
    spotifyId: parent.spotifyId,
    appleId: parent.appleId,
    youTubeChannelId: parent.youTubeChannelId,
    youTubePlaylistId: parent.youTubePlaylistId,
    twitterHandle: parent.twitterHandle,
    blueskyHandle: parent.blueskyHandle,
    removed: parent.removed
  };
}
