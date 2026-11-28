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

/** The admin dry run of a backlog index: what GET /podcast/index/{name}/backlog/preview answers (RPP #1433). */
export interface IndexBacklogPreviewResponse {
    /** Episodes not yet in the catalogue that the backlog index would ingest. */
    newEpisodeCount: number;
    /** How many of those would be ingested as ignored. */
    ignoredEpisodeCount: number;
}
