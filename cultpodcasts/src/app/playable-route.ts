import { GuidService } from "./guid.service";

export function episodeIdFromRouteQuery(guids: GuidService, query: string): string {
  const parsed = guids.parseCatalogueShortId(query);
  if (parsed?.id) {
    return parsed.id;
  }
  return guids.getEpisodeUuid(query);
}

/** Podcast page stays put. A guid now stored as Film, TV, or News leaves for that path. */
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
