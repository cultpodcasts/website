import { SearchResult } from './search-result.interface';
import { resolveServiceKey } from './service-catalog';
import { httpUrl, Trailer, trailerSearchDuration } from './trailer';

/**
 * TV show trailers on the rail (RPP #1412, `docs/tv-show-trailers.md`). The `Trailer` type, keep-list diff and stale
 * guard are shared with films: see `trailer.ts`. A TV show has no search document, so trailers come only from the
 * curator `GET tvshow/{id}` (`trailers`, in display order) and are not public.
 */

/** `contentKind` of a trailer card on the TV show page's Trailers rail (see catalogue-card). Not an RPP kind. */
export const TV_SHOW_TRAILER_CONTENT_KIND = 'TvShowTrailer';

/**
 * A trailer as a rail card (the TV twin of `filmTrailerEpisode`): the id is made up (`{tvShowId}:trailer:{n}`, unique
 * per show and position, for the player and queue); the URL becomes the one `services` entry for its host, so a
 * YouTube trailer gets its thumbnail and in-app Watch and any other host an outbound Watch. `podcastName` carries the
 * show name for the player dock. Null when the trailer has no usable http(s) URL.
 */
export function tvShowTrailerEpisode(
  trailer: Trailer,
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
    duration: trailerSearchDuration(trailer.duration),
    services: { [key]: { url, ...(image ? { image } : {}) } },
    contentKind: TV_SHOW_TRAILER_CONTENT_KIND,
  };
}

/** The rail cards for a show's trailers, in display order; trailers with no usable URL are skipped. */
export function tvShowTrailerEpisodes(
  trailers: readonly Trailer[] | null | undefined,
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
