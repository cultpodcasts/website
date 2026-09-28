import { GuidService } from "./guid.service";

export function episodeIdFromRouteQuery(guids: GuidService, query: string): string {
  const parsed = guids.parseCatalogueShortId(query);
  if (parsed?.id) {
    return parsed.id;
  }
  return guids.getEpisodeUuid(query);
}
