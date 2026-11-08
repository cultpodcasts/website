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
    /** 409 — another curator index is already running for this podcast. */
    alreadyRunning?: boolean;
    /** 504 — on-demand budget cut the walk off (common for full backlog). */
    timedOut?: boolean;
}


