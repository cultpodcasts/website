import { IHomepageItem } from "./IHomepageItem";

export interface IPreProcessedHomepage {
  totalDurationDays: number;
  episodesByDay: { [key: string]: IHomepageItem[]; };
  hasNext: boolean;
  episodesThisWeek: number;
  episodeCount: number;
}
