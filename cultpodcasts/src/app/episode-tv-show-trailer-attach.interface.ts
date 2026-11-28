/**
 * POST /episode/{podcastId}/{episodeId}/tvshow-trailer body (RPP #1412). Blank title keeps the episode title.
 * Either `tvShowId`, or `createShow` with `tvShowName` (the show with that name, created when none has it; giving
 * both is a 400).
 */
export interface EpisodeTvShowTrailerAttachRequest {
  tvShowId?: string;
  title?: string | null;
  createShow?: boolean;
  tvShowName?: string;
  /** Publisher of a show the attach creates. Only with createShow. */
  publisher?: string;
}

/** Command outcome (not the TV show read model): the show that now holds the trailer. On 409, the show that holds or claimed it. */
export interface EpisodeTvShowTrailerAttachResponse {
  tvShowId?: string | null;
  tvShowName?: string | null;
  error?: string;
  failureIndexing?: boolean;
  /** True when createShow created the show on this call. */
  showCreated?: boolean;
}

export interface AttachTvShowTrailerDialogData {
  podcastId: string;
  podcastName: string;
  episodeId: string;
  episodeTitle: string;
  /** The editor has unsaved changes, which attaching discards. */
  hasUnsavedChanges?: boolean;
}

export interface AttachTvShowTrailerDialogClose {
  attached: boolean;
  tvShowId?: string;
  tvShowName?: string;
  /** True when this attach created the show (no show had the name), so the show page has only this trailer. */
  showCreated?: boolean;
}
