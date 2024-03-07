export interface ISearchResult {
  podcastName: string;
  episodeTitle: string;
  episodeDescription: string;
  duration: string;
  release: Date;
  explicit: boolean;
  spotify: URL | undefined;
  apple: URL | undefined;
  youtube: URL | undefined;
  subjects: string[] | undefined
}
