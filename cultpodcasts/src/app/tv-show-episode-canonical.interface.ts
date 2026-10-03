export interface TvShowEpisodeCanonicalDto {
  id: string;
  tvShowId: string;
  title: string;
  imdb?: string | null;
  tvdb?: string | null;
}

/** Azure CanonicalUriPatch: omit = leave stored URI, `''` = clear, absolute URL = set. */
export interface TvShowEpisodeCanonicalChangeRequest {
  imdb?: string | null;
  tvdb?: string | null;
}
