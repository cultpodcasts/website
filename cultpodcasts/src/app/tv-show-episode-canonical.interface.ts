/** Azure CanonicalUriPatch: omit = leave stored URI, `''` = clear, absolute URL = set. */
export interface TvShowEpisodeCanonicalChangeRequest {
  imdb?: string | null;
  tvdb?: string | null;
}
