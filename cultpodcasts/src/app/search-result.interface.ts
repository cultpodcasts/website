export interface SearchResult {
  id: string;
  podcastName: string;
  episodeTitle: string;
  episodeDescription: string;
  release: Date;
  duration: string;
  ids?: import("./episode-ids.interface").EpisodeIds;
  spotifyId?: string;
  appleId?: string;
  podcastAppleId?: string;
  youtubeId?: string;
  bbc?: URL | string;
  internetArchive?: URL | string;
  svc?: string;
  services?: Record<string, { url?: string | URL | null; image?: string | URL | null }>;
  subjects?: string[];
  image?: URL | string;
  /** Non-English IETF tag from the search index when present; null/omitted ≈ English. */
  lang?: string | null;
  contentKind?: string | null;
  /** Film only: `{duration}|{url}|{title}` per trailer (see film-trailer.ts). */
  trailers?: string[] | null;
  /**
   * Additional YouTube uploads, one `{youTubeId}|{release}|{channelName}` token per upload in display
   * order (see youtube-alternate.ts; RPP #1411). Present on film, TV-episode, news and episode documents.
   */
  youTubeAlternates?: string[] | null;
  /**
   * Film only: other titles the film is known by (original, alternative and translated; RedditPodcastPoster#1431).
   * Searchable, so a search for any of them finds the film.
   */
  alternativeTitles?: string[] | null;
  /** Film or TV-episode IMDb title id (`tt…`); public identity links (RedditPodcastPoster#1437). */
  imdbId?: string | null;
  /** Film TMDB movie id, or a TV episode's TMDB episode id. */
  tmdbId?: number | string | null;
  /** TV episode TheTVDB episode id. */
  tvdbId?: number | string | null;
  /** Parent TV show IMDb title id, denormalised onto episode documents. */
  seriesImdbId?: string | null;
  /** Parent TV show TMDB series id. */
  seriesTmdbId?: number | string | null;
  /** Parent TV show TheTVDB series id. */
  seriesTvdbId?: number | string | null;
}
