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

/**
 * Azure Search says a missing field with "Could not find a property named …".
 * The /search proxy forwards that failure as HTTP 400 with an empty object.
 */
export function isUnknownSearchFieldError(error: unknown): boolean {
  const body = errorBody(error);
  const message = error && typeof error === "object" && "message" in error
    ? (error as { message: unknown }).message
    : undefined;
  if (containsUnknownFieldMessage(body) || containsUnknownFieldMessage(message)) {
    return true;
  }
  const status = errorStatus(error);
  return status === 400 && (body == null || isEmptyJsonObject(body));
}

/** Retry the live field once. A later failure drops the latch so the next search tries the new name again. */
export function nextLegacyNameLatch(legacyNames: boolean, error: unknown): { legacyNames: boolean; retry: boolean } {
  if (!legacyNames && isUnknownSearchFieldError(error)) {
    return { legacyNames: true, retry: true };
  }
  if (legacyNames) {
    return { legacyNames: false, retry: false };
  }
  return { legacyNames: false, retry: false };
}

function errorStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

function errorBody(error: unknown): unknown {
  if (error && typeof error === "object" && "error" in error) {
    return (error as { error: unknown }).error;
  }
  return undefined;
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

function isEmptyJsonObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0;
}
