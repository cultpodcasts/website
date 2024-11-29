export interface IHomepageItem {
  podcastName: string;
  episodeId: string;
  episodeTitle: string;
  episodeDescription: string;
  length: string;
  release: Date;
  spotify: URL | undefined;
  apple: URL | undefined;
  youtube: URL | undefined;
  subjects: string[] | undefined;
  image: URL | undefined;
}
