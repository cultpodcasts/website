import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * External catalogue ids (IMDb title ids, TMDB movie / tv ids): parse a typed id or a pasted page URL down to the
 * bare id, and build the page URL back from the id. The id is the source of truth; links are always built from it.
 */
export type ExternalIdKind = 'imdb' | 'tmdb-movie' | 'tmdb-tv';

/** IMDb title id: `tt` + 7–10 digits (the film PATCH rejects anything else). */
export const imdbIdPattern = /^tt\d{7,10}$/;

/** TMDB ids are positive 32-bit integers (RPP `int`). */
const tmdbMaxId = 2147483647;

const imdbHosts = new Set(['imdb.com', 'www.imdb.com', 'm.imdb.com']);
const tmdbHosts = new Set(['themoviedb.org', 'www.themoviedb.org']);

/** IMDb / TMDB locale path prefixes: `de`, `en-GB`, `pt-br`, … */
const localeSegment = /^[a-z]{2}(-[a-z]{2,4})?$/i;

function asUrl(text: string): URL | null {
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

function pathSegments(url: URL): string[] {
  return url.pathname.split('/').filter(segment => segment.length > 0);
}

/** Drops a leading locale segment (`/de/title/…`, `/en-GB/movie/…`) unless it is the expected keyword (`tv`). */
function dropLocale(segments: string[], keyword: string): void {
  if (segments.length > 0 && segments[0].toLowerCase() !== keyword && localeSegment.test(segments[0])) {
    segments.shift();
  }
}

/** `tt27531220`, `TT27531220`, or any imdb.com / m.imdb.com title URL → `tt27531220`. Blank → `''`. Invalid → null. */
export function parseImdbId(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  if (!text) {
    return '';
  }
  if (/^tt\d+$/i.test(text)) {
    const id = text.toLowerCase();
    return imdbIdPattern.test(id) ? id : null;
  }
  const url = asUrl(text);
  if (!url || !imdbHosts.has(url.hostname.toLowerCase())) {
    return null;
  }
  const segments = pathSegments(url);
  dropLocale(segments, 'title');
  if (segments.length < 2 || segments[0].toLowerCase() !== 'title') {
    return null;
  }
  const id = segments[1].toLowerCase();
  return imdbIdPattern.test(id) ? id : null;
}

function tmdbNumber(text: string): string | null {
  if (!/^\d+$/.test(text)) {
    return null;
  }
  const id = Number(text);
  return id >= 1 && id <= tmdbMaxId ? String(id) : null;
}

/**
 * `1109578`, or a themoviedb.org page URL of the right kind (`/movie/…` for films, `/tv/…` for TV shows, optional
 * locale prefix, slug, sub-pages, query and hash) → `1109578`. Blank → `''`. Invalid or the other kind → null.
 */
export function parseTmdbId(value: string | null | undefined, kind: 'movie' | 'tv'): string | null {
  const text = (value ?? '').trim();
  if (!text) {
    return '';
  }
  if (/^\d+$/.test(text)) {
    return tmdbNumber(text);
  }
  const url = asUrl(text);
  if (!url || !tmdbHosts.has(url.hostname.toLowerCase())) {
    return null;
  }
  const segments = pathSegments(url);
  dropLocale(segments, kind);
  if (segments.length < 2 || segments[0].toLowerCase() !== kind) {
    return null;
  }
  const match = /^(\d+)(-.*)?$/.exec(segments[1]);
  return match ? tmdbNumber(match[1]) : null;
}

/** The bare id for a kind (`''` when blank, null when not a valid id or page URL of that kind). */
export function parseExternalId(kind: ExternalIdKind, value: string | null | undefined): string | null {
  switch (kind) {
    case 'imdb':
      return parseImdbId(value);
    case 'tmdb-movie':
      return parseTmdbId(value, 'movie');
    case 'tmdb-tv':
      return parseTmdbId(value, 'tv');
  }
}

/** The item's page on the external site, or null when the value is blank / invalid. */
export function externalIdUrl(kind: ExternalIdKind, value: string | null | undefined): string | null {
  const id = parseExternalId(kind, value);
  if (!id) {
    return null;
  }
  switch (kind) {
    case 'imdb':
      return `https://www.imdb.com/title/${id}/`;
    case 'tmdb-movie':
      return `https://www.themoviedb.org/movie/${id}`;
    case 'tmdb-tv':
      return `https://www.themoviedb.org/tv/${id}`;
  }
}

/** Site name for labels and link text. */
export function externalIdSiteName(kind: ExternalIdKind): string {
  return kind === 'imdb' ? 'IMDb' : 'TMDB';
}

/** Error key set by {@link externalIdValidator}. */
export const externalIdErrorKey = 'externalId';

/** Valid when blank, a bare id, or a page URL of the kind that condenses to an id. */
export function externalIdValidator(kind: ExternalIdKind): ValidatorFn {
  return (control: AbstractControl<string | null>): ValidationErrors | null =>
    parseExternalId(kind, control.value) === null ? { [externalIdErrorKey]: true } : null;
}
