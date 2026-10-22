/** POST /episode/{podcastId}/{episodeId}/trailer body. Blank title keeps the episode title. */
export interface EpisodeTrailerAttachRequest {
  filmId: string;
  title?: string | null;
}

/** Command outcome (not the film read model): the film that now holds the trailer. */
export interface EpisodeTrailerAttachResponse {
  filmId?: string | null;
  name?: string | null;
  error?: string;
  failureIndexing?: boolean;
}

export interface AttachTrailerDialogData {
  podcastId: string;
  episodeId: string;
  episodeTitle: string;
  /** The editor has unsaved changes, which attaching discards. */
  hasUnsavedChanges?: boolean;
}

export interface AttachTrailerDialogClose {
  attached: boolean;
  filmId?: string;
  name?: string;
}
