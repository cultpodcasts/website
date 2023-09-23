import { IHomepageItem } from './IHomepageItem';

export interface IHomepage {
  recentEpisodes: IHomepageItem[];
  episodeCount: number;
  totalDuration: string;
}
