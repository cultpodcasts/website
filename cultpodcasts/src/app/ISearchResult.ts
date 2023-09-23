export interface ISearchResult {
  podcastName: string;
  publisher: string;
  episodeTitle: string;
  episodeDescription: string;
  length: string;
  release: Date;
  explicit: boolean;
  spotify: URL | undefined;
  apple: URL | undefined;
  youtube: URL | undefined;
}
