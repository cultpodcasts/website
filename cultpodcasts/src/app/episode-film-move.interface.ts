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
}

export interface MoveEpisodeToFilmDialogClose {
  moved: boolean;
  filmId?: string;
  name?: string;
}
