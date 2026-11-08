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

/**
 * Facet predicate for browse + hub. Empty when nothing is selected; otherwise a
 * leading ` and ` so callers can concat onto a series/hub filter.
 * Search-api strips the prefix because it AND-joins clauses itself.
 */
export function subjectsAnySearchIn(values: string[]): string {
  if (values.length === 0) {
    return "";
  }
  return ` and subjects/any(s: search.in(s, '${values.map((s) => escapedOData(s)).join("£")}', '£'))`;
}

export function seriesNameEquals(name: string): string {
  return `(seriesName eq '${escapedOData(name)}')`;
}

export function podcastNameEquals(name: string): string {
  return `(podcastName eq '${escapedOData(name)}')`;
}

export function contentKindEquals(kind: string): string {
  return `(contentKind eq '${escapedOData(kind)}')`;
}

export function hubContentKind(hub: "tv" | "news"): "TvShowEpisode" | "NewsReport" {
  return hub === "tv" ? "TvShowEpisode" : "NewsReport";
}

/** Search filter for `/tv` and `/news` hubs — same series-name field as podcasts, plus playable kind. */
export function catalogueHubFilter(name: string, hub: "tv" | "news", legacyNames: boolean): string {
  const series = legacyNames ? podcastNameEquals(name) : seriesNameEquals(name);
  return `${contentKindEquals(hubContentKind(hub))} and ${series}`;
}

/**
 * Probe for `/podcast/{name}` after a TV or news transfer. Film is not a parent
 * and Episode stays on the podcast page, so those kinds are omitted.
 */
export function transferredSeriesHubFilter(name: string, legacyNames: boolean): string {
  const series = legacyNames ? podcastNameEquals(name) : seriesNameEquals(name);
  return `${series} and (contentKind eq 'NewsReport' or contentKind eq 'TvShowEpisode')`;
}

/** Index field the cards filter and facet. New name until a missing-field response latches the live one. */
export function playableSeriesField(legacyNames: boolean): "podcastName" | "seriesName" {
  return legacyNames ? "podcastName" : "seriesName";
}

export function rewritePlayableSeriesField(filter: string, legacyNames: boolean): string {
  return legacyNames
    ? filter.replaceAll("seriesName", "podcastName")
    : filter.replaceAll("podcastName", "seriesName");
}

const UNKNOWN_SEARCH_FIELD = /could not find a property named/i;
const NAMED_SEARCH_FIELD = /could not find a property named ['"]([^'"]+)['"]/i;

/**
 * Property Azure named in "Could not find a property named '…'".
 * Api `/search` forwards that envelope (cultpodcasts/Api#215); do not treat opaque
 * empty 400 bodies as an unknown-field signal.
 */
export function unknownSearchFieldName(error: unknown): string | null {
  const body = errorBody(error);
  const message = error && typeof error === "object" && "message" in error
    ? (error as { message: unknown }).message
    : undefined;
  return namedSearchField(body) ?? namedSearchField(message);
}

export function isUnknownSearchFieldError(error: unknown): boolean {
  const body = errorBody(error);
  const message = error && typeof error === "object" && "message" in error
    ? (error as { message: unknown }).message
    : undefined;
  return containsUnknownFieldMessage(body) || containsUnknownFieldMessage(message);
}

/** Azure named seriesName or podcastName as missing — the only miss that latches the live series field. */
export function isUnknownSeriesNameField(error: unknown): boolean {
  const field = unknownSearchFieldName(error);
  return field === "seriesName" || field === "podcastName";
}

/**
 * A missing contentKind field is not a series-name miss. Named contentKind (or any
 * other non-series field) should drop kind — not latch podcastName.
 */
export function isUnknownContentKindField(error: unknown): boolean {
  if (!isUnknownSearchFieldError(error)) {
    return false;
  }
  return !isUnknownSeriesNameField(error);
}

/** Retry podcastName once only when Azure names seriesName/podcastName as missing. */
export function nextLegacyNameLatch(legacyNames: boolean, error: unknown): { legacyNames: boolean; retry: boolean } {
  if (!legacyNames && isUnknownSeriesNameField(error)) {
    return { legacyNames: true, retry: true };
  }
  return { legacyNames: false, retry: false };
}

function errorBody(error: unknown): unknown {
  if (error && typeof error === "object" && "error" in error) {
    return (error as { error: unknown }).error;
  }
  return undefined;
}

function namedSearchField(value: unknown): string | null {
  if (typeof value === "string") {
    return value.match(NAMED_SEARCH_FIELD)?.[1] ?? null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = namedSearchField(item);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const found = namedSearchField(item);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function containsUnknownFieldMessage(value: unknown): boolean {
  if (typeof value === "string") {
    return UNKNOWN_SEARCH_FIELD.test(value);
  }
  if (Array.isArray(value)) {
    return value.some(containsUnknownFieldMessage);
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(containsUnknownFieldMessage);
  }
  return false;
}

