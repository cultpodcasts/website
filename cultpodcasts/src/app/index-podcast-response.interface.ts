import { IndexedEpisode } from "./indexed-rpisode.interface";

export interface IndexPodcastResponse {
    indexedEpisodes?: IndexedEpisode[];
}

/** What the index dialog closes with for a podcast. */
export interface PodcastIndexDialogResult {
    updated?: boolean;
    episodeIds?: string[];
    podcastNotAutoIndex?: boolean;
    podcastNotFound?: boolean;
}


