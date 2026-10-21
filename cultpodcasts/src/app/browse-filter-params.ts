import { ActivatedRoute, Params, Router } from '@angular/router';
import { Location } from '@angular/common';
import {
  ALL_LANGUAGES_VALUE,
  ENGLISH_LANGUAGE_VALUE,
  isEnglishLanguageFacetCode
} from './subject-language-filter';

/**
 * Browse filter chips (search + subject pages) mirrored into the URL fragment,
 * e.g. `/subject/Topic#show=Show%20A&lang=sw,ki`, so a filtered page can be
 * bookmarked or shared. The fragment is URLSearchParams-style. Path and query
 * params (`sort`, `page`, `filter`) are left alone. The fragment never reaches
 * the server, which is fine: the filtered results only render client-side
 * (inside `@defer`).
 */
export const SHOW_PARAM = 'show';
export const SUBJECT_PARAM = 'subject';
export const KIND_PARAM = 'kind';
export const LANG_PARAM = 'lang';

const ALL_LANGUAGES_TOKEN = 'all';
const ENGLISH_TOKEN = 'en';
const LANGUAGE_CODE = /^[a-z]{2,3}(-[a-z0-9]{1,8})*$/i;

/** Repeated (`?show=A&show=B`) or single values, trimmed, blank and duplicate values dropped. */
export function readParamList(params: Params, key: string): string[] {
  const raw = params?.[key];
  const values = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
  return unique(values.map(value => String(value).trim()).filter(value => !!value));
}

/**
 * Language chip values → `lang` param. English on its own is the default and
 * gives no param; All is `all`; otherwise comma-separated codes with `en` for
 * the English chip, in click order.
 */
export function encodeLanguageParam(chipValues: string[]): string | null {
  if (chipValues.includes(ALL_LANGUAGES_VALUE)) {
    return ALL_LANGUAGES_TOKEN;
  }
  const tokens = unique(chipValues.map(value => value === ENGLISH_LANGUAGE_VALUE ? ENGLISH_TOKEN : value));
  if (tokens.length === 0 || (tokens.length === 1 && tokens[0] === ENGLISH_TOKEN)) {
    return null;
  }
  return tokens.join(',');
}

/**
 * `lang` param → language chip values, or null when the param is missing or
 * has nothing usable (the caller then keeps the English default). Malformed
 * codes are dropped; `all` anywhere wins; `en` / `en-*` are the English chip.
 */
export function decodeLanguageParam(raw: unknown): string[] | null {
  const parts = (Array.isArray(raw) ? raw : [raw])
    .filter(value => typeof value === 'string')
    .flatMap(value => (value as string).split(','))
    .map(value => value.trim())
    .filter(value => !!value);
  if (parts.some(value => value.toLowerCase() === ALL_LANGUAGES_TOKEN)) {
    return [ALL_LANGUAGES_VALUE];
  }
  const values = unique(parts
    .filter(value => LANGUAGE_CODE.test(value))
    .map(value => isEnglishLanguageFacetCode(value) ? ENGLISH_LANGUAGE_VALUE : value));
  return values.length ? values : null;
}

/**
 * Fragment (as the router hands it over, already percent-decoded) → params.
 * Repeated keys become arrays; no fragment gives no params.
 */
export function parseFilterFragment(fragment: string | null | undefined): Params {
  const params: Params = {};
  if (!fragment) {
    return params;
  }
  for (const [key, value] of new URLSearchParams(fragment)) {
    const existing = params[key];
    params[key] = existing === undefined ? value : [...(Array.isArray(existing) ? existing : [existing]), value];
  }
  return params;
}

/**
 * Filter params → fragment, or null when every filter is empty (the default
 * state has no fragment). Repeated keys for lists (show names can contain
 * commas). Only the characters that would break the key/value split are
 * escaped here; the router percent-encodes the rest when it writes the URL.
 */
export function buildFilterFragment(filters: Record<string, string | string[] | null>): string | null {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(filters)) {
    const values = value === null ? [] : Array.isArray(value) ? value : [value];
    for (const item of values.filter(item => item !== '')) {
      parts.push(`${escapeFragmentPart(key)}=${escapeFragmentPart(item)}`);
    }
  }
  return parts.length ? parts.join('&') : null;
}

/**
 * Order-insensitive key for route params, query params and fragment. Lets a
 * page recognise the URL it just wrote and skip reloading, whether the router
 * reports a single repeated param as a string or a one-item array.
 */
export function routeStateKey(params: Params, queryParams: Params, fragment: string | null | undefined): string {
  return JSON.stringify([canonical(params), canonical(queryParams), fragment || null]);
}

/** Restored values that the facet list actually offers; unknown values are ignored. */
export function keepOffered(values: string[], offered: { value: string }[] | undefined): string[] {
  const known = new Set((offered ?? []).map(facet => facet.value));
  return values.filter(value => known.has(value));
}

function canonical(params: Params): [string, string[]][] {
  return Object.keys(params ?? {})
    .sort()
    .map(key => {
      const raw = params[key];
      const values = Array.isArray(raw) ? raw : [raw];
      return [key, values.filter(value => value !== undefined && value !== null).map(String)] as [string, string[]];
    })
    .filter(([, values]) => values.length > 0);
}

function escapeFragmentPart(value: string): string {
  return value.replace(/[%&=+#]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Subject chips only (podcast and TV/news hub pages): `#subject=A&subject=B`.
 * Unknown subjects are dropped by the caller once the facets are known.
 */
export function readSubjectsFromFragment(fragment: string | null | undefined): string[] {
  return readParamList(parseFilterFragment(fragment), SUBJECT_PARAM);
}

/** `#subject=…` for the given subject chips, or null for none. */
export function subjectsFragment(subjects: string[]): string | null {
  return buildFilterFragment({ [SUBJECT_PARAM]: subjects });
}

/**
 * How a filter fragment write lands in browser history: `push` for a filter
 * the user changed (Back returns to the previous selection), `replace` for
 * restoring or tidying the URL (initial load, dropped unknown values,
 * reconciled chips) so it adds no entry of its own.
 */
export type FragmentHistory = 'push' | 'replace';

/**
 * Write the filter fragment, keeping path and query. scroll: 'manual' stops
 * the router scrolling (to the top, or to an anchor) on every chip click.
 * Callers skip the write when the fragment is unchanged, so no duplicate
 * history entries are pushed.
 *
 * The router always replaces when the new URL equals the current one without
 * its hash (Location.isCurrentPathEqualTo ignores the hash), so a push that
 * removes the fragment would overwrite the filtered entry. Then the current
 * entry is duplicated first and the router replaces the copy.
 */
export function writeUrlFragment(
  router: Router,
  route: ActivatedRoute,
  location: Location,
  fragment: string | null,
  history: FragmentHistory
): void {
  let replaceUrl = history === 'replace';
  if (!replaceUrl && !fragment) {
    const current = location.path(true);
    if (current !== location.path(false)) {
      location.go(current, '', location.getState());
    }
    replaceUrl = true;
  }
  router.navigate([], {
    relativeTo: route,
    queryParamsHandling: 'preserve',
    fragment: fragment ?? undefined,
    replaceUrl,
    scroll: 'manual'
  });
}

/** The route's path and query without the fragment, to tell Back/Forward between filter states from leaving the page. */
export function routePathKey(params: Params, queryParams: Params): string {
  return routeStateKey(params, queryParams, null);
}
