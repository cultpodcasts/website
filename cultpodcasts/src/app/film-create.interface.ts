import { AmbiguousIdentityPrompt } from './ambiguous-identity-dialog/ambiguous-identity-dialog.component';

/**
 * POST /film body (RPP #1413). Give a TMDB movie id, an IMDb title id, or a title to look up. With ids the title only
 * overrides the identity name. A title with no ids runs the same identity gate as Move to film.
 */
export interface FilmCreateRequest {
  tmdbId?: number | null;
  imdbId?: string | null;
  title?: string | null;
  publisher?: string | null;
  identityDecision?: 'select' | 'continue' | 'cancel' | null;
  selectedIdentityKey?: string | null;
}

/**
 * Command outcome (not the film read model). 202: the new film. 409: the film that already has the identity or name.
 * 500 with failureIndexing: the film was kept but the search push failed.
 */
export interface FilmCreateResponse {
  filmId?: string | null;
  name?: string | null;
  error?: string;
  failureIndexing?: boolean;
  /** Present on 200 when a title-only lookup is ambiguous; nothing was created. */
  identityDecision?: AmbiguousIdentityPrompt | null;
  /** True on 200 when the curator cancelled the identity prompt. */
  cancelled?: boolean;
}

export interface CreateFilmDialogClose {
  /** True when this call created the film. */
  created: boolean;
  /** True when the film already existed (409) and the curator chose to open it. */
  existing?: boolean;
  filmId?: string;
  name?: string;
  /** The film was created but is not in search yet (a film save or the scheduled film push indexes it). */
  failureIndexing?: boolean;
}
