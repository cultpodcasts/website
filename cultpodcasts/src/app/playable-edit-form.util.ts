import { AbstractControl, FormArray, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { episodeLanguageFormValue } from './language-options.util';
import { ensureHashPrefix, hashPrefixedTagValidator } from './podcast-form.util';
import {
  FilmChangeRequest,
  FilmDto,
  PlayableFieldsChangeRequest,
  PlayableFieldsDto,
  TvShowEpisodeChangeRequest,
  TvShowEpisodeDto
} from './playable-edit.interface';
import { buildTvShowEpisodeCanonicalChangeRequest } from './tv-show-episode-canonical.util';
import { resolveServiceKey } from './service-catalog';

/**
 * Reactive form for the news report / TV episode edit dialogs. Same control names as the podcast
 * `EpisodeForm` where the field exists there, so the shared tabs read like the episode editor.
 * `imdb` / `tvdb` are only present on the TV form (Identity tab); the film form has `imdb` (no TheTVDB) and
 * `publisher`, and its `title` (the film name) is disabled: the film PATCH cannot rename.
 */
export interface PlayableEditForm {
  title: FormControl<string>;
  description: FormControl<string>;
  posted: FormControl<boolean>;
  tweeted: FormControl<boolean>;
  ignored: FormControl<boolean>;
  removed: FormControl<boolean>;
  explicit: FormControl<boolean>;
  /** `yyyy-MM-dd` (news / TV releases have no time of day). */
  release: FormControl<string>;
  /** `h:mm:ss`. */
  duration: FormControl<string>;
  subjects: FormControl<string[]>;
  searchTerms: FormControl<string>;
  hashTag: FormControl<string>;
  /** Language code, or `unset` for English. */
  lang: FormControl<string>;
  guests: FormControl<string[]>;
  imdb?: FormControl<string>;
  tvdb?: FormControl<string>;
  publisher?: FormControl<string>;
  /** Film: IMDb title id (`tt…`); blank clears. */
  imdbId?: FormControl<string>;
  /** Film: TMDB id as digits; blank clears. */
  tmdbId?: FormControl<string>;
  /** Film: one URL per link (YouTube, BBC iPlayer, Internet Archive, …); the service comes from the URL. */
  links?: FormArray<FormControl<string>>;
  /** Film: the trailers to keep, in display order, each with an editable title. */
  trailers?: FormArray<FilmTrailerEditGroup>;
}

export type FilmTrailerEditGroup = FormGroup<{ id: FormControl<string>; title: FormControl<string> }>;

/** IMDb title id: `tt` + 7–10 digits (the film PATCH rejects anything else). */
export const imdbIdPattern = /^tt\d{7,10}$/;

/**
 * A film link must be an absolute http(s) URL whose service key resolves (a known service, else a key derived from the
 * host, as the episode editor does); the film's existing links pass as they are, whatever key they are stored under.
 */
export function filmLinkValidator(existing: ReadonlySet<string> = new Set()): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const text = (control.value ?? '').trim();
    if (!text || existing.has(text)) {
      return null;
    }
    const url = absoluteHttpUrl(text);
    if (!url) {
      return { filmLinkUrl: true };
    }
    return resolveServiceKey(url) ? null : { filmLinkService: true };
  };
}

/** Two links for one service would overwrite each other in the PATCH. */
export function filmLinksDistinctValidator(existing: ReadonlyMap<string, string> = new Map()): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const seen = new Set<string>();
    for (const value of (control as FormArray<FormControl<string>>).getRawValue()) {
      const key = existing.get(value.trim()) ?? filmLinkKey(value);
      if (!key) {
        continue;
      }
      if (seen.has(key)) {
        return { filmLinkDuplicate: key };
      }
      seen.add(key);
    }
    return null;
  };
}

function absoluteHttpUrl(text: string): URL | undefined {
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : undefined;
  } catch {
    return undefined;
  }
}

/** The service key a link files under, or undefined for blank / invalid / unknown links. */
export function filmLinkKey(value: string | null | undefined): string | undefined {
  const url = absoluteHttpUrl((value ?? '').trim());
  return url ? resolveServiceKey(url) ?? undefined : undefined;
}

/** The film's stored links: URL text → the key it is stored under. */
export function filmExistingLinks(services: FilmDto['services']): Map<string, string> {
  const links = new Map<string, string>();
  for (const [key, link] of Object.entries(services ?? {})) {
    const url = uriText(link?.url);
    if (url) links.set(url, key);
  }
  return links;
}

export function newFilmLinkControl(value = '', existing: ReadonlySet<string> = new Set()): FormControl<string> {
  return new FormControl(value, { nonNullable: true, validators: [filmLinkValidator(existing)] });
}

export function newFilmTrailerGroup(id: string, title: string): FilmTrailerEditGroup {
  return new FormGroup({
    id: new FormControl(id, { nonNullable: true }),
    title: new FormControl(title, { nonNullable: true })
  });
}

/** Film release: a year `yyyy` or a calendar date `yyyy-MM-dd` (anything else is a 400 from the film PATCH). */
export const filmReleasePattern = /^\d{4}(-\d{2}-\d{2})?$/;

/** json-url.interceptor turns absolute URL strings in API bodies into `URL` objects. */
function uriText(value: string | URL | null | undefined): string {
  return value == null ? '' : value.toString();
}

export type PlayableEditFormValue = ReturnType<FormGroup<PlayableEditForm>['getRawValue']>;

/**
 * Which playable the shared edit form is for: `news` (playable fields only), `tv` (plus IMDb + TheTVDB) or `film`
 * (plus IMDb and publisher, with a read-only name and a year-or-date release). One value drives the form, the
 * dialog base and the shared tabs, so there are no flags that can contradict each other.
 */
export type PlayableEditVariant = 'news' | 'tv' | 'film';

/** The Identity tab (IMDb, plus TheTVDB for TV) shows for TV and film. */
export function playableEditHasIdentity(variant: PlayableEditVariant): boolean {
  return variant !== 'news';
}

export function buildPlayableEditForm(dto: PlayableFieldsDto, variant: PlayableEditVariant = 'news'): FormGroup<PlayableEditForm> {
  const controls: PlayableEditForm = {
    title: new FormControl(dto.title ?? '', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl(dto.description ?? '', { nonNullable: true }),
    posted: new FormControl(!!dto.posted, { nonNullable: true }),
    tweeted: new FormControl(!!dto.tweeted, { nonNullable: true }),
    ignored: new FormControl(!!dto.ignored, { nonNullable: true }),
    removed: new FormControl(!!dto.removed, { nonNullable: true }),
    explicit: new FormControl(!!dto.explicit, { nonNullable: true }),
    release: new FormControl(dto.release ?? '', { nonNullable: true }),
    duration: new FormControl(dto.duration ?? '', { nonNullable: true }),
    subjects: new FormControl<string[]>([...(dto.subjects ?? [])], { nonNullable: true }),
    searchTerms: new FormControl(dto.searchTerms ?? '', { nonNullable: true }),
    hashTag: new FormControl(ensureHashPrefix(dto.hashTag), {
      nonNullable: true,
      validators: [hashPrefixedTagValidator()]
    }),
    lang: new FormControl(episodeLanguageFormValue(dto.language), { nonNullable: true }),
    guests: new FormControl<string[]>([...(dto.guests ?? [])], { nonNullable: true })
  };
  if (variant === 'film') {
    const film = dto as FilmDto;
    // Read-only name: no required marker, and never part of validity or the PATCH.
    controls.title.clearValidators();
    controls.title.disable();
    controls.release.addValidators(Validators.pattern(filmReleasePattern));
    controls.imdb = new FormControl(uriText(film.imdb), { nonNullable: true });
    controls.publisher = new FormControl(film.publisher ?? '', { nonNullable: true });
    controls.imdbId = new FormControl(film.imdbId ?? '', {
      nonNullable: true,
      validators: [Validators.pattern(imdbIdPattern)]
    });
    controls.tmdbId = new FormControl(film.tmdbId ? String(film.tmdbId) : '', {
      nonNullable: true,
      validators: [Validators.pattern(/^\d*$/)]
    });
    const existingLinks = filmExistingLinks(film.services);
    const existingUrls = new Set(existingLinks.keys());
    controls.links = new FormArray(
      [...existingLinks.keys()].map(url => newFilmLinkControl(url, existingUrls)),
      { validators: [filmLinksDistinctValidator(existingLinks)] }
    );
    controls.trailers = new FormArray(
      (film.trailers ?? []).map(trailer => newFilmTrailerGroup(trailer.id, trailer.title ?? ''))
    );
  } else if (variant === 'tv') {
    const tv = dto as TvShowEpisodeDto;
    controls.imdb = new FormControl(uriText(tv.imdb), { nonNullable: true });
    controls.tvdb = new FormControl(uriText(tv.tvdb), { nonNullable: true });
  }
  return new FormGroup<PlayableEditForm>(controls);
}

function sameStrings(a: readonly string[] | null | undefined, b: readonly string[] | null | undefined): boolean {
  const left = a ?? [];
  const right = b ?? [];
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * Only the changed playable fields, in the PATCH wire shape. Blank title / release / duration are
 * never sent (the API cannot clear them). Bluesky can only be removed (`unBluesky`), never set.
 */
export function playableFieldsChanges(
  previous: PlayableFieldsDto,
  next: PlayableEditFormValue,
  pendingUnBluesky = false
): PlayableFieldsChangeRequest {
  const changes: PlayableFieldsChangeRequest = {};
  const title = next.title.trim();
  if (title && title !== previous.title) changes.title = title;
  if (next.description !== (previous.description ?? '')) changes.description = next.description;
  const release = next.release.trim();
  if (release && release !== (previous.release ?? '')) changes.release = release;
  const duration = next.duration.trim();
  if (duration && duration !== (previous.duration ?? '')) changes.duration = duration;
  if (next.posted !== !!previous.posted) changes.posted = next.posted;
  if (next.tweeted !== !!previous.tweeted) changes.tweeted = next.tweeted;
  if (pendingUnBluesky && previous.blueskyPosted) changes.unBluesky = true;
  if (next.explicit !== !!previous.explicit) changes.explicit = next.explicit;
  if (next.ignored !== !!previous.ignored) changes.ignored = next.ignored;
  if (next.removed !== !!previous.removed) changes.removed = next.removed;
  if (!sameStrings(previous.subjects, next.subjects)) changes.subjects = [...next.subjects];
  const searchTerms = next.searchTerms.trim();
  if (searchTerms !== (previous.searchTerms ?? '').trim()) changes.searchTerms = searchTerms;
  const hashTag = ensureHashPrefix(next.hashTag);
  if (hashTag !== ensureHashPrefix(previous.hashTag)) changes.hashTag = hashTag;
  if (!sameStrings(previous.guests, next.guests)) changes.guests = [...next.guests];
  const lang = episodeLanguageFormValue(next.lang === 'unset' ? null : next.lang);
  if (lang !== episodeLanguageFormValue(previous.language)) changes.language = lang === 'unset' ? '' : lang;
  return changes;
}

/** Playable fields plus the Identity tab (omit / `''` clear / URL set, same as the old identity dialog). */
export function tvShowEpisodeChanges(
  previous: TvShowEpisodeDto,
  next: PlayableEditFormValue,
  pendingUnBluesky = false
): TvShowEpisodeChangeRequest {
  const changes: TvShowEpisodeChangeRequest = playableFieldsChanges(previous, next, pendingUnBluesky);
  const identity = buildTvShowEpisodeCanonicalChangeRequest(
    { imdb: uriText(previous.imdb), tvdb: uriText(previous.tvdb) },
    { imdb: next.imdb, tvdb: next.tvdb }
  );
  if (identity.imdb != null) changes.imdb = identity.imdb;
  if (identity.tvdb != null) changes.tvdb = identity.tvdb;
  return changes;
}

/**
 * Film PATCH body: the changed playable fields without `title` (the film PATCH has none; renames are admin-only),
 * plus `publisher` (`''` clears) and the IMDb identity (omit / `''` clear / URL set).
 */
export function filmChanges(
  previous: FilmDto,
  next: PlayableEditFormValue,
  pendingUnBluesky = false
): FilmChangeRequest {
  const { title: _title, ...changes }: PlayableFieldsChangeRequest = playableFieldsChanges(previous, next, pendingUnBluesky);
  const film: FilmChangeRequest = changes;
  const publisher = (next.publisher ?? '').trim();
  if (next.publisher !== undefined && publisher !== (previous.publisher ?? '').trim()) film.publisher = publisher;
  if (next.imdb !== undefined) {
    const identity = buildTvShowEpisodeCanonicalChangeRequest({ imdb: uriText(previous.imdb) }, { imdb: next.imdb });
    if (identity.imdb != null) film.imdb = identity.imdb;
  }
  if (next.imdbId !== undefined) {
    const imdbId = next.imdbId.trim();
    if (imdbId !== (previous.imdbId ?? '')) film.imdbId = imdbId;
  }
  if (next.tmdbId !== undefined) {
    const tmdbId = next.tmdbId.trim() === '' ? 0 : Number(next.tmdbId.trim());
    if (tmdbId !== (previous.tmdbId ?? 0)) film.tmdbId = tmdbId;
  }
  if (next.links !== undefined) {
    const services = filmServiceChanges(previous.services, next.links);
    if (services) film.services = services;
  }
  if (next.trailers !== undefined) {
    const trailers = filmTrailerChanges(previous, next.trailers);
    if (trailers) film.trailers = trailers;
  }
  return film;
}

/**
 * The film `services` patch: each link files under the key its URL resolves to (as the server does); a key the film
 * had that no link resolves to any more is removed (`url` and `image` blank). Null when nothing changed.
 */
export function filmServiceChanges(
  previous: FilmDto['services'],
  links: readonly string[]
): Record<string, { url?: string; image?: string }> | null {
  const existing = filmExistingLinks(previous);
  const before = new Map<string, string>([...existing].map(([url, key]) => [key, url]));
  const after = new Map<string, string>();
  for (const value of links) {
    const url = value.trim();
    // An unchanged link keeps the key it is stored under; a new one files under the key its URL resolves to.
    const key = existing.get(url) ?? filmLinkKey(url);
    if (key) after.set(key, url);
  }
  const changes: Record<string, { url?: string; image?: string }> = {};
  for (const [key, url] of after) {
    if (before.get(key) !== url) changes[key] = { url };
  }
  for (const key of before.keys()) {
    if (!after.has(key)) changes[key] = { url: '', image: '' };
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

/** The film `trailers` patch (keep / order / rename), or null when the list and titles are unchanged. */
export function filmTrailerChanges(
  previous: FilmDto,
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
