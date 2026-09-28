import { GuidService } from "./guid.service";
import { HomepageEpisode } from "./homepage-episode.interface";
import { SearchResult } from "./search-result.interface";

type CatalogueItem = HomepageEpisode | SearchResult;

/** Mixed lists choose a card with these paths. Podcast pages do not call this. */
export function cataloguePlayableLink(item: CatalogueItem): string[] {
  switch (item.contentKind) {
    case "Film":
      return ["/film", item.episodeTitle, item.id];
    case "TvShowEpisode":
      return ["/tv", item.podcastName, item.id];
    case "NewsReport":
      return ["/news", item.podcastName, item.id];
    default:
      return ["/podcast", item.podcastName, item.id];
  }
}

/** Film has no parent. TV and news hubs use the parent name. */
export function catalogueParentLink(item: CatalogueItem | undefined): string[] | null {
  if (!item) {
    return null;
  }
  switch (item.contentKind) {
    case "Film":
      return null;
    case "TvShowEpisode":
      return item.podcastName ? ["/tv", item.podcastName] : null;
    case "NewsReport":
      return item.podcastName ? ["/news", item.podcastName] : null;
    default:
      return item.podcastName ? ["/podcast", item.podcastName] : null;
  }
}

/** Podcast page stays put. A guid stored as Film, TV, or News leaves for that path. */
export function movedKindRedirect(
  currentPath: string,
  episode: { id: string; contentKind?: string | null; episodeTitle: string; podcastName: string },
  guids: GuidService
): string | null {
  const slug = episode.contentKind === "Film" ? episode.episodeTitle : episode.podcastName;
  if (!slug) {
    return null;
  }
  const target = guids.movedPlayablePath(slug, episode.id, episode.contentKind);
  if (!target) {
    return null;
  }
  const here = decodeURI(currentPath.split("?")[0]);
  return here === decodeURI(target) ? null : target;
}
