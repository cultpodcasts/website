import { IEpisode } from "./IEpisode";

export interface IHomepage {
  recentEpisodes: IEpisode[];
  episodeCount: number;
  totalDuration: string;
}
