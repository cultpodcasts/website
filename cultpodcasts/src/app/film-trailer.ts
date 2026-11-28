import { SearchResult } from './search-result.interface';
import { resolveServiceKey } from './service-catalog';
import { displayDuration, httpUrl } from './trailer';

/**
 * Film trailers on the public side. The film search document has one `{duration}|{url}|{title}` token per trailer (RPP
 * `FilmTrailerSearchToken`), in display order. The title is last and may itself contain `|`, so a token splits on its
 * first two `|` only. The `Trailer` type (curator GET) is shared with TV shows: see `trailer.ts`.
 */

/** One trailer as listed on the film page (from the search document). */
export interface FilmTrailerLink {
  title: string;
  url: URL;
  /** `h:mm:ss` or `mm:ss`, without leading zero hours; empty when unknown. */
  duration: string;
  /** The token's own duration (search `duration` format, e.g. `00:07:58`), as cards expect it. */
  searchDuration: string;
}

/** `contentKind` of a trailer card on the film page's Trailers rail (see catalogue-card). Not an RPP kind. */
export const FILM_TRAILER_CONTENT_KIND = 'FilmTrailer';

/**
 * A trailer as a rail card. The search token has only duration, URL and title, so: the id is made up (unique per
 * film and position, for the player and queue); the URL becomes the one `services` entry for its host, so a YouTube
 * trailer gets its thumbnail and in-app Watch and an iPlayer / Archive one an outbound Watch. `podcastName` carries
 * the film title for the player dock and the queue show line. The card passes a null parent link and a "Trailer"
 * kind label, so that title does not replace the poster byline. There is no image, release or description.
 */
export function filmTrailerEpisode(
  link: FilmTrailerLink,
  filmId: string,
  index: number,
  filmTitle = ''
): SearchResult {
  const key = resolveServiceKey(link.url) ?? 'link';
  return {
    id: `${filmId}:trailer:${index}`,
    podcastName: filmTitle.trim(),
    episodeTitle: link.title,
    episodeDescription: '',
    release: new Date(Number.NaN),
    duration: link.searchDuration,
    services: { [key]: { url: link.url } },
    contentKind: FILM_TRAILER_CONTENT_KIND,
  };
}

/** Parses the search document's `trailers` tokens. Malformed tokens and non-http(s) URLs are skipped. */
export function parseFilmTrailerTokens(tokens: readonly string[] | null | undefined): FilmTrailerLink[] {
  const links: FilmTrailerLink[] = [];
  for (const token of tokens ?? []) {
    if (typeof token !== 'string') {
      continue;
    }
    const first = token.indexOf('|');
    const second = first < 0 ? -1 : token.indexOf('|', first + 1);
    if (second < 0) {
      continue;
    }
    const url = httpUrl(token.slice(first + 1, second));
    const title = token.slice(second + 1).trim();
    if (!url || !title) {
      continue;
    }
    const searchDuration = token.slice(0, first).trim();
    links.push({ title, url, duration: displayDuration(searchDuration), searchDuration });
  }
  return links;
}

