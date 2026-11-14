import { AmbiguousIdentityPrompt } from './ambiguous-identity-dialog/ambiguous-identity-dialog.component';

/**
 * POST /episode/{podcastId}/{episodeId}/trailer body. Blank title keeps the episode title.
 * Either filmId, or createFilm with filmName: the film with that name, created when no film has it (RPP #1418).
 */
export interface EpisodeTrailerAttachRequest {
  filmId?: string;
  title?: string | null;
  createFilm?: boolean;
  filmName?: string;
  identityDecision?: 'select' | 'continue' | 'cancel' | null;
  selectedIdentityKey?: string | null;
}

/** Command outcome (not the film read model): the film that now holds the trailer. */
export interface EpisodeTrailerAttachResponse {
  filmId?: string | null;
  name?: string | null;
  error?: string;
  failureIndexing?: boolean;
  /** True when createFilm created the film on this call. */
  filmCreated?: boolean;
  /** createFilm only: present on 200 when the new film's IMDb/TMDB match is ambiguous; nothing was written. */
  identityDecision?: AmbiguousIdentityPrompt | null;
  /** createFilm only: true on 200 when the identity prompt was cancelled. */
  cancelled?: boolean;
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
