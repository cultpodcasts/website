export interface SearchResult {
  id: string;
  podcastName: string;
  episodeTitle: string;
  episodeDescription: string;
  release: Date;
  duration: string;
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
}