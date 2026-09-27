import { HomepageEpisode } from "./homepage-episode.interface";
import { SearchResult } from "./search-result.interface";

type CardEpisode = HomepageEpisode | SearchResult;

export function playableCommands(episode: CardEpisode): string[] {
  const kind = episode.contentKind;
  if (kind === "Film") {
    return ["/film", episode.episodeTitle, episode.id];
  }
  if (kind === "TvShowEpisode") {
    return ["/tv", episode.podcastName, episode.id];
  }
  if (kind === "NewsReport") {
    return ["/news", episode.podcastName, episode.id];
  }
  return ["/podcast", episode.podcastName, episode.id];
}

/** Film has no parent. TV and news hubs use the parent name. */
export function parentCommands(episode: CardEpisode): string[] | null {
  if (!episode.podcastName || episode.contentKind === "Film") {
    return null;
  }
  if (episode.contentKind === "TvShowEpisode") {
    return ["/tv", episode.podcastName];
  }
  if (episode.contentKind === "NewsReport") {
    return ["/news", episode.podcastName];
  }
  return ["/podcast", episode.podcastName];
}
