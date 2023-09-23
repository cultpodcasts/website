
export interface IHomepageItem {
  podcastName: string;
  episodeTitle: string;
  episodeDescription: string;
  length: string;
  release: Date;
  spotify: URL | undefined;
  apple: URL | undefined;
  youtube: URL | undefined;
}
