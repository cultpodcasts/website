/** POST /catalogue/identity/lookup — edit-time Identity tab probe. */
export type CatalogueIdentityLookupKind = 'Film' | 'TvShow' | 'TvShowEpisode';

export interface CatalogueIdentityIds {
  imdbId?: string | null;
  tmdbId?: number | null;
  tvdbId?: number | null;
}

export interface CatalogueIdentityLookupRequest {
  kind: CatalogueIdentityLookupKind;
  title: string;
  year?: number | null;
  showName?: string | null;
  showTmdbId?: number | null;
  showTvdbId?: number | null;
  showImdbId?: string | null;
  identityDecision?: 'select' | 'continue' | 'cancel' | null;
  selectedIdentityKey?: string | null;
}

export interface CatalogueIdentityLookupResponse {
  status: 'Matched' | 'Ambiguous' | 'NoMatch';
  message?: string | null;
  ids?: CatalogueIdentityIds | null;
  parentIds?: CatalogueIdentityIds | null;
  identityDecision?: {
    target: string;
    query: string;
    candidates: {
      key: string;
      title: string;
      year?: number | null;
      kind: string;
      source: string;
      tmdbId?: number | null;
      tvdbId?: number | null;
      pageUrl?: string | null;
      thumbnailUrl?: string | null;
      description?: string | null;
    }[];
  } | null;
}
