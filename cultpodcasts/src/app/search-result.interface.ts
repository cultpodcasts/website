import { HomepageEpisode } from "./homepage-episode.interface";

export interface SearchResult extends HomepageEpisode {
  explicit: boolean;
}