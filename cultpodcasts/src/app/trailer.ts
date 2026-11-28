import { SearchResult } from './search-result.interface';

/**
 * A trailer, teaser or clip attached to a film or a TV show (RPP #1412). The curator `GET film/{id}` and
 * `GET tvshow/{id}` carry the same JSON shape, in display order. A film's trailers are also public through its search
 * document (see `film-trailer.ts`); a TV show has no search document, so its trailers are curator-only.
 */
export interface Trailer {
  /** Id of the episode the trailer was attached from. */
  id: string;
  title: string;
  /** Absolute URLs arrive as `URL` objects (json-url.interceptor). */
  url: string | URL;
  image?: string | URL | null;
  /** UTC instant; `JsonDateInterceptor` turns it into a `Date`. */
  release?: Date | null;
  /** `h:mm:ss`. */
  duration: string;
}

/** What holds the trailers: a film, or a TV show. */
export type TrailerParentKind = 'film' | 'tv';

/** How a trailer parent is named in curator text. */
export interface TrailerParentLabels {
  /** The parent: `film` or `TV show`. */
  noun: string;
  /** What the episode editor's Catalogue tab calls the attach: `trailer` or `TV trailer/clip`. */
  attach: string;
}

export const TRAILER_PARENT_LABELS: Readonly<Record<TrailerParentKind, TrailerParentLabels>> = {
  film: { noun: 'film', attach: 'trailer' },
  tv: { noun: 'TV show', attach: 'TV trailer/clip' }
};

/** `{parentId}:trailer:{n}` → the film or TV show id. Null when `id` is not a trailer card id. */
export function trailerParentId(id: string): string | null {
  const match = /^(.+):trailer:\d+$/.exec(id);
  return match?.[1] || null;
}

/** The trailer's own page (its video URL): where its card title links, in a new tab. */
export function trailerUrl(episode: { services?: SearchResult['services'] }): string | undefined {
  for (const service of Object.values(episode.services ?? {})) {
    if (service?.url) {
      return service.url.toString();
    }
  }
  return undefined;
}

/** The http(s) URL for the text or URL, or undefined for anything else (`javascript:`, malformed, empty). */
export function httpUrl(value: string | URL | null | undefined): URL | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const url = value instanceof URL ? value : new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : undefined;
  } catch {
    return undefined;
  }
}

/** `[d.]h:mm:ss[.fraction]`: a day part is kept as hours. Null for anything else. */
function parseDuration(value: string | null | undefined): { hours: number; minutes: string; seconds: string } | null {
  const match = /^(?:(\d+)\.)?(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?$/.exec((value ?? '').trim());
  if (!match) {
    return null;
  }
  return { hours: Number(match[1] ?? 0) * 24 + Number(match[2]), minutes: match[3], seconds: match[4] };
}

/** `00:02:11.9910000` → `2:11`; `01:02:03` → `1:02:03`; a day part (`1.02:00:00`) is kept as hours. Unknown text is ''. */
export function displayDuration(value: string): string {
  const parts = parseDuration(value);
  if (!parts) {
    return '';
  }
  return parts.hours > 0
    ? `${parts.hours}:${parts.minutes}:${parts.seconds}`
    : `${Number(parts.minutes)}:${parts.seconds}`;
}

/** `0:02:11` or `00:02:11.99` → `00:02:11`, the search `duration` format the cards expect. Unknown text is ''. */
export function trailerSearchDuration(value: string | null | undefined): string {
  const parts = parseDuration(value);
  return parts ? `${String(parts.hours).padStart(2, '0')}:${parts.minutes}:${parts.seconds}` : '';
}

/**
 * The film or TV show `trailers` patch (keep / order / rename), or null when the list and titles are unchanged. A blank
 * title keeps the stored one on the server, so it is sent as `{ id }` only.
 */
export function trailerChanges(
  previous: { trailers?: readonly { id: string; title?: string | null }[] | null },
  next: readonly { id: string; title: string }[]
): { id: string; title?: string }[] | null {
  const before = previous.trailers ?? [];
  const unchanged = before.length === next.length &&
    before.every((trailer, index) => trailer.id === next[index].id && (trailer.title ?? '') === next[index].title.trim());
  if (unchanged) {
    return null;
  }
  return next.map(trailer => {
    const title = trailer.title.trim();
    return title ? { id: trailer.id, title } : { id: trailer.id };
  });
}

/** Shown when trailers were attached after the editor opened, so saving its keep-list would drop them. */
export function staleTrailersMessage(added: number, parent: TrailerParentKind): string {
  const { noun } = TRAILER_PARENT_LABELS[parent];
  return `${added === 1 ? 'A trailer was' : `${added} trailers were`} attached to this ${noun} after the editor opened. ` +
    `Nothing was saved. Close and reopen the ${noun} to edit its trailers.`;
}

/**
 * The 409 body of a film or TV show PATCH that carried a stale trailer keep-list: `unexpectedTrailerIds` names the
 * trailers the editor never saw. Returns the curator message, or undefined when the error is not that conflict.
 */
export function staleTrailersError(error: unknown, parent: TrailerParentKind): string | undefined {
  const response = error as { status?: unknown; error?: { unexpectedTrailerIds?: unknown } | null } | null;
  if (response?.status !== 409) {
    return undefined;
  }
  const ids = response.error?.unexpectedTrailerIds;
  return Array.isArray(ids) && ids.length > 0 ? staleTrailersMessage(ids.length, parent) : undefined;
}
