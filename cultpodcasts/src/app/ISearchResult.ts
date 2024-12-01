export interface ISearchResult {
  podcastName: string;
  id: string;
  episodeTitle: string;
  episodeDescription: string;
  duration: string;
  release: Date;
  explicit: boolean;
  spotify: URL | undefined;
  apple: URL | undefined;
  youtube: URL | undefined;
  bbc: URL | undefined;
  internetArchive: URL | undefined;
  subjects: string[] | undefined
  image: URL | undefined;
}