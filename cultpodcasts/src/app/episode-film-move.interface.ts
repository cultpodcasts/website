/** POST /episode/{podcastId}/{episodeId}/film body. Blank title keeps the episode title. */
export interface EpisodeFilmMoveRequest {
  title?: string | null;
}

/** Command outcome (not the film read model). On 409, the film that already has the name. */
export interface EpisodeFilmMoveResponse {
  filmId?: string | null;
  name?: string | null;
  error?: string;
  failureIndexing?: boolean;
}

export interface MoveEpisodeToFilmDialogData {
  podcastId: string;
  episodeId: string;
  episodeTitle: string;
  /** The editor has unsaved changes, which moving discards. */
  hasUnsavedChanges?: boolean;
  /** Episode release; a recent one can be re-added to the podcast by the Indexer (RPP #1068). */
  release?: Date | string | null;
}

export interface MoveEpisodeToFilmDialogClose {
  moved: boolean;
  filmId?: string;
  name?: string;
}
