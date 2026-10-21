import { SearchIndexerState } from "./search-indexer-state.interface";

/**
 * GET /newsorganisation/{identifier} or /tvshow/{identifier}: the shared publisher fields (RPP #1053).
 * TV adds the canonical identity URLs.
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
  imdb?: string | null;
  tvdb?: string | null;
}

/** PATCH body. Omitted = unchanged; "" clears a string; [] clears a list. No `name`: rename is separate. */
export type CatalogueParentChangeRequest = Partial<Omit<CatalogueParentDto, "id" | "name">>;

/** POST /newsorganisation/name/{identifier} or /tvshow/name/{identifier} (admin). */
export interface CatalogueParentRenameRequest {
  newName: string;
}

export interface CatalogueParentRenameResponse {
  indexState?: SearchIndexerState;
}
