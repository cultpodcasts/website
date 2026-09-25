import { SearchResult } from "./search-result.interface";

/** Card fields the templates already bind. New index names win when present. */
export function normalizePlayableHit(hit: SearchResult & {
  title?: string;
  seriesName?: string;
  description?: string;
}): SearchResult {
  return {
    ...hit,
    episodeTitle: hit.title || hit.episodeTitle || "",
    podcastName: hit.seriesName || hit.podcastName || "",
    episodeDescription: hit.description || hit.episodeDescription || "",
  };
}

export function escapedOData(value: string): string {
  return value.replaceAll("'", "''");
}

export function seriesNameEquals(name: string): string {
  return `(seriesName eq '${escapedOData(name)}')`;
}

export function podcastNameEquals(name: string): string {
  return `(podcastName eq '${escapedOData(name)}')`;
}
