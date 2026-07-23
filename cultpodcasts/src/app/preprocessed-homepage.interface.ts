import { HomepageEpisode } from './homepage-episode.interface';

/** Matches RPP PreProcessedHomePageModel / R2 key homepage-ssr. */
export interface PreProcessedHomepage {
  totalDurationDays: number;
  episodesByDay: { [dayLabel: string]: HomepageEpisode[] };
  hasNext: boolean;
  episodesThisWeek: number;
  episodeCount: number;
}
