import { HomepageEpisode } from "./homepage-episode.interface";
import { SearchResult } from "./search-result.interface";

type CardEpisode = HomepageEpisode | SearchResult;

/** Podcast cards only. Film, TV, and news cards live under catalogue/. */
export function playableCommands(episode: CardEpisode): string[] {
  return ["/podcast", episode.podcastName, episode.id];
}

export function parentCommands(episode: CardEpisode): string[] | null {
  if (!episode.podcastName) {
    return null;
  }
  return ["/podcast", episode.podcastName];
}
