/**
 * Film trailers. The curator GET `film/{id}` has full trailer objects; the film search document has one
 * `{duration}|{url}|{title}` token per trailer (RPP `FilmTrailerSearchToken`), in display order. The title is last
 * and may itself contain `|`, so a token splits on its first two `|` only.
 */
export interface FilmTrailer {
  /** Id of the episode the trailer was attached from. */
  id: string;
  title: string;
  /** Absolute URLs arrive as `URL` objects (json-url.interceptor). */
  url: string | URL;
  image?: string | URL | null;
  release?: string | null;
  /** `h:mm:ss`. */
  duration: string;
}

/** One trailer as listed on the film page (from the search document). */
export interface FilmTrailerLink {
  title: string;
  url: URL;
  /** `h:mm:ss` or `mm:ss`, without leading zero hours; empty when unknown. */
  duration: string;
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
    links.push({ title, url, duration: displayDuration(token.slice(0, first)) });
  }
  return links;
}

function httpUrl(text: string): URL | undefined {
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : undefined;
  } catch {
    return undefined;
  }
}

/** `00:02:11.9910000` → `2:11`; `01:02:03` → `1:02:03`; a day part (`1.02:00:00`) is kept as hours. */
export function displayDuration(value: string): string {
  const match = /^(?:(\d+)\.)?(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?$/.exec(value.trim());
  if (!match) {
    return '';
  }
  const hours = Number(match[1] ?? 0) * 24 + Number(match[2]);
  const minutes = Number(match[3]);
  const seconds = match[4];
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}
