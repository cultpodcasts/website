import { Episode } from "./episode.interface";

export interface Homepage {
  recentEpisodes: Episode[];
  episodeCount: number;
  totalDuration: string;
}
