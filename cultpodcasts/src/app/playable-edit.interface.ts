import { EpisodeChangeResponse } from './episode-change-response.interface';

/**
 * Curator GET body shared by `newsreport/{id}` and `tvshowepisode/{id}` (RPP `PlayableFieldsDto`).
 * Release is a calendar date `yyyy-MM-dd`; duration is `h:mm:ss`. English language is null.
 */
export interface PlayableFieldsDto {
  id: string;
  title: string;
  description: string;
  release?: string | null;
  duration: string;
  explicit: boolean;
  ignored: boolean;
  removed: boolean;
  posted: boolean;
  tweeted: boolean;
  blueskyPosted: boolean;
  subjects: string[];
  searchTerms?: string | null;
  hashTag?: string | null;
  language?: string | null;
  /** Guest person names (null when none). The GET has no guestPeople / guestSuggestions. */
  guests?: string[] | null;
  services?: Record<string, { url?: string; image?: string; lang?: string }> | null;
}

export interface NewsReportDto extends PlayableFieldsDto {
  newsOrganisationId: string;
  newsOrganisationName?: string | null;
}

export interface TvShowEpisodeDto extends PlayableFieldsDto {
  tvShowId: string;
  tvShowName?: string | null;
  /** Absolute URLs arrive as `URL` objects (json-url.interceptor). */
  imdb?: string | URL | null;
  imdbId?: string | null;
  tvdb?: string | URL | null;
  tvdbId?: number | null;
  tmdbId?: number | null;
}

/**
 * Curator GET `film/{id}` (RPP `FilmDto`): a film is a publisher that is also playable, so the GET has the
 * publisher fields (`name`, `publisher`, `defaultSubject`, …) and the playable fields a film has. There is no
 * `title`: the display name is `name`, renamed only by the admin rename screen (`POST film/name/{id}`). The
 * dialog copies `name` into `title` so the shared form can show it read-only. Release is `yyyy` (year-only)
 * or `yyyy-MM-dd`.
 */
export interface FilmDto extends PlayableFieldsDto {
  name: string;
  /** Network / label / brand attribution. */
  publisher?: string | null;
  defaultSubject?: string | null;
  /** Absolute URLs arrive as `URL` objects (json-url.interceptor). */
  imdb?: string | URL | null;
  imdbId?: string | null;
  tmdbId?: number | null;
}

/** The `film/{id}` GET wire body (no `title`). */
export type FilmApiDto = Omit<FilmDto, 'title'>;

/** PATCH body (RPP `PlayableFieldsChangeRequest`): omitted = unchanged. */
export interface PlayableFieldsChangeRequest {
  title?: string;
  description?: string;
  release?: string;
  duration?: string;
  posted?: boolean;
  tweeted?: boolean;
  unBluesky?: boolean;
  explicit?: boolean;
  ignored?: boolean;
  removed?: boolean;
  subjects?: string[];
  searchTerms?: string;
  /** `''` clears. */
  hashTag?: string;
  guests?: string[];
  /** `''` clears (English). */
  language?: string;
}

export type NewsReportChangeRequest = PlayableFieldsChangeRequest;

/** TV adds the canonical identity URIs: omit = leave, `''` = clear, absolute URL = set. */
export interface TvShowEpisodeChangeRequest extends PlayableFieldsChangeRequest {
  imdb?: string;
  tvdb?: string;
}

/**
 * PATCH `film/{id}` (RPP `FilmChangeRequest`): the playable fields a film has, `publisher` (`''` clears) and the
 * IMDb identity URI (omit = leave, `''` = clear, absolute URL = set). Never `title`: the film PATCH has no title
 * (renames go through the admin rename screen).
 */
export interface FilmChangeRequest extends Omit<PlayableFieldsChangeRequest, 'title'> {
  publisher?: string;
  imdb?: string;
}

/** 202 body, same as the episode PATCH (`EpisodeUpdateResponse`). */
export interface PlayableChangeResponse extends EpisodeChangeResponse {
  searchIndexerState?: string | null;
}

export interface EditPlayableDialogResponse {
  closed?: boolean;
  noChange?: boolean;
  updated?: boolean;
  response?: PlayableChangeResponse | null;
  /** Parent (outlet / show) name from the GET, for Review links. */
  parentName?: string | null;
}
