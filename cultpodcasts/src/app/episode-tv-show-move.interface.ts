/** POST /episode/{podcastId}/{episodeId}/tvshow body. Exactly one of tvShowId / tvShowName. Blank title keeps the episode title. */
export interface EpisodeTvShowMoveRequest {
  tvShowId?: string;
  tvShowName?: string;
  /** With tvShowName: create the show when no show has the name (an existing show with the name is joined). */
  createShow?: boolean;
  /** Publisher of a show the move creates. Only with createShow. */
  publisher?: string;
  title?: string;
}

/** Command outcome (not the TV show read model). On 409, the show the episode is already in. */
export interface EpisodeTvShowMoveResponse {
  tvShowId?: string | null;
  tvShowName?: string | null;
  episodeId?: string | null;
  createdShow?: boolean;
  error?: string;
  failureIndexing?: boolean;
  /** Move of a news report only: the news organisation the move left with no reports (RPP #1368). */
  emptiedNewsOrganisationId?: string | null;
}

export interface MoveEpisodeToTvShowDialogData {
  podcastId: string;
  podcastName: string;
  episodeId: string;
  episodeTitle: string;
  /** The editor has unsaved changes, which moving discards. */
  hasUnsavedChanges?: boolean;
  /** Episode release; a recent one can be re-added to the podcast by the Indexer (RPP #1068). */
  release?: Date | string | null;
  /**
   * Set to move this news report instead of a podcast episode (POST /newsreport/{id}/tvshow, RPP #1368).
   * podcastId and episodeId are then ignored; podcastName is the news organisation name.
   */
  newsReportId?: string;
}

export interface MoveEpisodeToTvShowDialogClose {
  moved: boolean;
  tvShowId?: string;
  tvShowName?: string;
  episodeId?: string;
  createdShow?: boolean;
  /** Move of a news report only: the news organisation the move left with no reports. */
  emptiedNewsOrganisationId?: string;
}
