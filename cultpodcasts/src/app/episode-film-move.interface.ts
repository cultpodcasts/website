import { AmbiguousIdentityPrompt } from './ambiguous-identity-dialog/ambiguous-identity-dialog.component';

/** POST /episode/{podcastId}/{episodeId}/film body. Blank title keeps the episode title. */
export interface EpisodeFilmMoveRequest {
  title?: string | null;
  identityDecision?: 'select' | 'continue' | 'cancel' | null;
  selectedIdentityKey?: string | null;
}

/** Command outcome (not the film read model). On 409, the film that already has the name. */
export interface EpisodeFilmMoveResponse {
  filmId?: string | null;
  name?: string | null;
  error?: string;
  failureIndexing?: boolean;
  /** Present on 200 when IMDb/TMDB is ambiguous; nothing was created. */
  identityDecision?: AmbiguousIdentityPrompt | null;
  /** True on 200 when the curator cancelled the identity prompt. */
  cancelled?: boolean;
  /** Move of a news report only: the news organisation the move left with no reports (RPP #1368). */
  emptiedNewsOrganisationId?: string | null;
}

export interface MoveEpisodeToFilmDialogData {
  podcastId: string;
  episodeId: string;
  episodeTitle: string;
  /** The editor has unsaved changes, which moving discards. */
  hasUnsavedChanges?: boolean;
  /** Episode release; a recent one can be re-added to the podcast by the Indexer (RPP #1068). */
  release?: Date | string | null;
  /**
   * Set to move this news report instead of a podcast episode (POST /newsreport/{id}/film, RPP #1368).
   * podcastId and episodeId are then ignored.
   */
  newsReportId?: string;
}

export interface MoveEpisodeToFilmDialogClose {
  moved: boolean;
  filmId?: string;
  name?: string;
  /** Move of a news report only: the news organisation the move left with no reports. */
  emptiedNewsOrganisationId?: string;
}
