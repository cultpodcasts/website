import { filmIdFromTrailerId, httpUrl } from './film-trailer';
import { SearchResult } from './search-result.interface';
import { resolveServiceKey } from './service-catalog';

/**
 * A trailer, teaser or clip attached to a TV show (RPP #1412, `docs/tv-show-trailers.md`). Same JSON shape as a film
 * trailer. A TV show has no search document, so trailers come only from the curator `GET tvshow/{id}`
 * (`trailers`, in display order) and are not public.
 */
export interface TvShowTrailer {
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

/** `contentKind` of a trailer card on the TV show page's Trailers rail (see catalogue-card). Not an RPP kind. */
export const TV_SHOW_TRAILER_CONTENT_KIND = 'TvShowTrailer';

/** `{tvShowId}:trailer:{n}` → the TV show id. Null when `id` is not a TV show trailer id. */
export function tvShowIdFromTrailerId(id: string): string | null {
  // The same `{parentId}:trailer:{n}` shape as a film trailer id.
  return filmIdFromTrailerId(id);
}

/** `0:02:11` or `00:02:11.99` → `00:02:11`, the search `duration` format the cards expect. Unknown text is ''. */
export function tvShowTrailerSearchDuration(value: string | null | undefined): string {
  const match = /^(?:(\d+)\.)?(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?$/.exec((value ?? '').trim());
  if (!match) {
    return '';
  }
  const hours = Number(match[1] ?? 0) * 24 + Number(match[2]);
  return `${String(hours).padStart(2, '0')}:${match[3]}:${match[4]}`;
}

/**
 * A trailer as a rail card (the TV twin of `filmTrailerEpisode`): the id is made up (`{tvShowId}:trailer:{n}`, unique
 * per show and position, for the player and queue); the URL becomes the one `services` entry for its host, so a
 * YouTube trailer gets its thumbnail and in-app Watch and any other host an outbound Watch. `podcastName` carries the
 * show name for the player dock. Null when the trailer has no usable http(s) URL.
 */
export function tvShowTrailerEpisode(
  trailer: TvShowTrailer,
  tvShowId: string,
  index: number,
  showName = ''
): SearchResult | null {
  const url = httpUrl(trailer.url);
  if (!url) {
    return null;
  }
  const key = resolveServiceKey(url) ?? 'link';
  const image = httpUrl(trailer.image);
  const release = trailer.release instanceof Date ? trailer.release : new Date(Number.NaN);
  return {
    id: `${tvShowId}:trailer:${index}`,
    podcastName: showName.trim(),
    episodeTitle: trailer.title,
    episodeDescription: '',
    release,
    duration: tvShowTrailerSearchDuration(trailer.duration),
    services: { [key]: { url, ...(image ? { image } : {}) } },
    contentKind: TV_SHOW_TRAILER_CONTENT_KIND,
  };
}

/** The rail cards for a show's trailers, in display order; trailers with no usable URL are skipped. */
export function tvShowTrailerEpisodes(
  trailers: readonly TvShowTrailer[] | null | undefined,
  tvShowId: string,
  showName = ''
): SearchResult[] {
  const episodes: SearchResult[] = [];
  (trailers ?? []).forEach((trailer, index) => {
    const episode = tvShowTrailerEpisode(trailer, tvShowId, index, showName);
    if (episode) {
      episodes.push(episode);
    }
  });
  return episodes;
}

/**
 * The TV show `trailers` patch (keep / order / rename), or null when the list and titles are unchanged. A blank title
 * keeps the stored one on the server, so it is sent as `{ id }` only.
 */
export function tvShowTrailerChanges(
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

export function staleTvShowTrailersMessage(added: number): string {
  return `${added === 1 ? 'A trailer was' : `${added} trailers were`} attached to this TV show after the editor opened. ` +
    'Nothing was saved. Close and reopen the TV show to edit its trailers.';
}

/**
 * The 409 body of a TV show PATCH that carried a stale trailer keep-list: `unexpectedTrailerIds` names the trailers the
 * editor never saw. Returns the curator message, or undefined when the error is not that conflict.
 */
export function staleTvShowTrailersError(error: unknown): string | undefined {
  const response = error as { status?: unknown; error?: { unexpectedTrailerIds?: unknown } | null } | null;
  if (response?.status !== 409) {
    return undefined;
  }
  const ids = response.error?.unexpectedTrailerIds;
  return Array.isArray(ids) && ids.length > 0 ? staleTvShowTrailersMessage(ids.length) : undefined;
}
