import { HomepageEpisode } from "./homepage-episode.interface";

export interface Homepage {
  recentEpisodes: HomepageEpisode[];
  episodeCount: number;
  totalDuration: string;
}
