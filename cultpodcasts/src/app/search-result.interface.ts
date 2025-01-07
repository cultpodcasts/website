import { Episode } from "./episode.interface";

export interface SearchResult extends Episode {
  explicit: boolean;
}