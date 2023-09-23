export interface ISearchResult {
  Podcast: string;
  Publisher: string;
  Title: string;
  Description: string;
  Released: Date;
  Length: string;
  Explicit: boolean;
  Spotify: URL | undefined;
  Apple: URL | undefined;
  YouTube: URL | undefined;
}
