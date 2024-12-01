import { IEpisode } from "./IEpisode";

export interface ISearchResult extends IEpisode {
  explicit: boolean;
}