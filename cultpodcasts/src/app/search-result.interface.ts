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
  subjects?: string[];
  image?: URL | string;
}