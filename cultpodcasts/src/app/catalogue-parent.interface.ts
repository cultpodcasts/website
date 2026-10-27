import { SearchIndexerState } from "./search-indexer-state.interface";

/**
 * GET /newsorganisation/{identifier} or /tvshow/{identifier}: the shared publisher fields (RPP #1053).
 * TV adds the identity ids.
 */
export interface CatalogueParentDto {
  id: string;
  name: string;
  publisher?: string | null;
  description?: string | null;
  language?: string | null;
  removed?: boolean | null;
  twitterHandle?: string | null;
  blueskyHandle?: string | null;
  hashTag?: string | null;
  enrichmentHashTags?: string[] | null;
  searchTerms?: string | null;
  knownTerms?: string[] | null;
  defaultSubject?: string | null;
  ignoredSubjects?: string[] | null;
  ignoredAssociatedSubjects?: string[] | null;
  /** TV show identity ids (no URLs): IMDb `tt` id, TheTVDB series id, TMDB id. Clear: `''`, `0`, `0`. */
  imdbId?: string | null;
  tvdbId?: number | null;
  tmdbId?: number | null;
  /**
   * Service ids (RPP #1053 `ServiceIdsDto`, stored under the parent's `indexing`). URL submission matches a
   * submitted episode's channel / show to the outlet or show on these. Empty / null when unset.
   */
  youTubeChannelId?: string | null;
  youTubePlaylistId?: string | null;
  /** Read-only: playlist ids replaced by an edit. */
  youTubePlaylistIdHistory?: { id: string; replacedAt: string }[] | null;
  spotifyId?: string | null;
  appleId?: number | null;
  /** From `indexing`: auto-index every item, or only titles matching the include regex. */
  indexAllEpisodes?: boolean | null;
  titleRegex?: string | null;
  descriptionRegex?: string | null;
  episodeMatchRegex?: string | null;
  episodeIncludeTitleRegex?: string | null;
  /**
   * Podcast flags kept on `indexing` (same wire names and rules as the podcast edit API).
   * `bypassShortEpisodeChecking` is the effective value: a news organisation that never set it reads `true`.
   */
  ignoreAllEpisodes?: boolean | null;
  bypassShortEpisodeChecking?: boolean | null;
  alwaysPromoteAsHero?: boolean | null;
  skipEnrichingFromYouTube?: boolean | null;
  /** TimeSpan text (e.g. `00:01:30`); "" clears. */
  minimumDuration?: string | null;
  /** TimeSpan text, may be negative (e.g. `-1:00:00`); "" clears. */
  youTubePublicationDelay?: string | null;
  releaseAuthority?: string | null;
}

/**
 * PATCH body. Omitted = unchanged; "" clears a string; [] clears a list; `nullAppleId: true` clears `appleId`.
 * No `name` (rename is separate) and no `youTubePlaylistIdHistory` (server-kept).
 */
export type CatalogueParentChangeRequest = Partial<Omit<CatalogueParentDto, "id" | "name" | "youTubePlaylistIdHistory">> & {
  nullAppleId?: boolean;
  /** `true` clears `releaseAuthority`. */
  unsetReleaseAuthority?: boolean;
};

/** POST /newsorganisation/name/{identifier} or /tvshow/name/{identifier} (admin). */
export interface CatalogueParentRenameRequest {
  newName: string;
}

export interface CatalogueParentRenameResponse {
  indexState?: SearchIndexerState;
}
