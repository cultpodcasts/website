import { HomepageEpisode } from "./homepage-episode.interface";
import { SearchResult } from "./search-result.interface";

type CardEpisode = HomepageEpisode | SearchResult;

/** Podcast cards only. Film, TV, and news each have their own card component. */
export function playableCommands(episode: CardEpisode): string[] {
  return ["/podcast", episode.podcastName, episode.id];
}

export function parentCommands(episode: CardEpisode): string[] | null {
  if (!episode.podcastName) {
    return null;
  }
  return ["/podcast", episode.podcastName];
}
