export interface TvShowEpisodeCanonicalDto {
  id: string;
  tvShowId: string;
  title: string;
  imdb?: string | null;
  tvdb?: string | null;
}

export interface TvShowCanonicalChangeRequest {
  imdb?: string | null;
  tvdb?: string | null;
}
