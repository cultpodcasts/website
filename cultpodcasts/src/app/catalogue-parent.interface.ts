import { SearchIndexerState } from "./search-indexer-state.interface";
import { YouTubeIndexingHints } from "./youtube-indexing-hints.interface";

/**
 * One replaced YouTube playlist id. `replacedAt` is a UTC ISO instant (`...Z`) on the wire, and
 * `JsonDateInterceptor` turns it into a `Date` before the dialog sees it.
 */
export interface PlaylistIdHistoryEntry {
  id: string;
  replacedAt: Date;
}

/**
 * One additional YouTube channel of a news organisation (RPP #1370). With `youTubePlaylistId` only that playlist's
 * videos belong to the organisation (URL submit, indexing and discovery are scoped to it); without one the whole
 * channel does.
 */
export interface AdditionalYouTubeChannelDto {
  youTubeChannelId: string;
  youTubePlaylistId?: string | null;
}

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
  /**
   * News organisations only (RPP #1370): extra YouTube channels the outlet owns and ingests from, besides
   * `youTubeChannelId`, each with an optional playlist that scopes that channel (the top-level `youTubePlaylistId`
   * scopes only the main channel). GET gives `[]` when there are none. PATCH: a list replaces the stored list, `[]`
   * clears it, omitted / null leaves it unchanged. TV shows never have or send it.
   */
  additionalYouTubeChannels?: AdditionalYouTubeChannelDto[] | null;
  /**
   * News organisations only, read-only here: the older ids-only form of `additionalYouTubeChannels` (GET returns
   * both). The dialog reads it only when `additionalYouTubeChannels` is missing and never sends it: the API refuses a
   * PATCH that sends both.
   */
  additionalYouTubeChannelIds?: string[] | null;
  /** Read-only: playlist ids replaced by an edit. */
  youTubePlaylistIdHistory?: PlaylistIdHistoryEntry[] | null;
  /** Indexer-owned YouTube playlist walk hints (read-only). Clear via `clearYouTubeIndexingHints`. */
  youTubeIndexingHints?: YouTubeIndexingHints | null;
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
   * These are the stored values (unset is off). New news organisations are saved with `bypassShortEpisodeChecking`
   * and `alwaysPromoteAsHero` on; a curator can switch either off afterwards.
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
 * No `name` (rename is separate), no `youTubePlaylistIdHistory` / `youTubeIndexingHints` (server-kept),
 * no `skipEnrichingFromYouTube` (not edited on news / TV, so it is never sent and a stored value is kept)
 * and no `youTubeChannelId` (read-only, like the podcast edit dialog: it is used for API calls, so it is
 * never sent and the stored value is kept). Additional channels are sent only as `additionalYouTubeChannels`, never as
 * the older `additionalYouTubeChannelIds`.
 */
export type CatalogueParentChangeRequest = Partial<
  Omit<
    CatalogueParentDto,
    | "id"
    | "name"
    | "youTubePlaylistIdHistory"
    | "youTubeIndexingHints"
    | "skipEnrichingFromYouTube"
    | "youTubeChannelId"
    | "additionalYouTubeChannelIds"
  >
> & {
  nullAppleId?: boolean;
  /** `true` clears `releaseAuthority`. */
  unsetReleaseAuthority?: boolean;
  /** `true` clears indexer-owned `youTubeIndexingHints` (force full playlist walk). */
  clearYouTubeIndexingHints?: boolean;
};

/** POST /newsorganisation/name/{identifier} or /tvshow/name/{identifier} (admin). */
export interface CatalogueParentRenameRequest {
  newName: string;
}

export interface CatalogueParentRenameResponse {
  indexState?: SearchIndexerState;
}
