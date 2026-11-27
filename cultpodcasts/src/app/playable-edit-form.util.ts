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
import { resolveServiceKey } from './service-catalog';
import { youtubeVideoId } from './youtube-alternate';
import { utcCalendarDateText } from './utc-calendar-date';

/**
 * Calendar text for a form or DTO release that may still be a `Date` after
 * {@link JsonDateInterceptor} (production bug: Submit / unBluesky threw
 * `release.trim is not a function`). Accepts `unknown` so callers need not cast
 * through `FormControl<string>`.
 */
function releaseFormText(value: unknown): string {
  if (value instanceof Date || typeof value === 'string' || value == null) {
    return utcCalendarDateText(value);
  }
  return '';
}

/**
 * Reactive form for the news report / TV episode edit dialogs. Same control names as the podcast
 * `EpisodeForm` where the field exists there, so the shared tabs read like the episode editor.
 * `imdbId` / `tmdbId` are on the TV and film forms (Identity tab), `tvdbId` on the TV form only. Ids only: page URLs
 * for the Open buttons are generated from them. The film form also has `publisher`, and its `title` (the film name)
 * is disabled: the film PATCH cannot rename.
 */
export interface PlayableEditForm {
  title: FormControl<string>;
  description: FormControl<string>;
  posted: FormControl<boolean>;
  tweeted: FormControl<boolean>;
  blueskyPosted: FormControl<boolean>;
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
  publisher?: FormControl<string>;
  /** TV / film: IMDb title id (`tt…`); blank clears. */
  imdbId?: FormControl<string>;
  /** TV / film: TMDB id as digits; blank clears. */
  tmdbId?: FormControl<string>;
  /** TV: TheTVDB episode id as digits; blank clears. */
  tvdbId?: FormControl<string>;
  /** Film: other titles the film is known by, one per line (RedditPodcastPoster#1431). */
  alternativeTitles?: FormControl<string>;
  /** Film: identity image (TMDB backdrop or poster); blank clears (RedditPodcastPoster#1435). */
  image?: FormControl<string>;
  /**
   * News / TV / film: one row per service link (YouTube, BBC iPlayer, Internet Archive, …). The service key comes
   * from the URL; `image` is the matching `services.*.image`. Shared by the Urls and Images tabs (podcast-episode
   * naming). Always built by `buildPlayableEditForm`; optional on the type so non-playable form consumers stay compatible.
   */
  links?: FormArray<PlayableServiceLinkGroup>;
  /** Film: the trailers to keep, in display order, each with an editable title. */
  trailers?: FormArray<FilmTrailerEditGroup>;
  /** News / TV / film: additional YouTube uploads to keep, in display order (RPP #1411 / #1526). */
  additionalYouTube?: FormArray<YouTubeAlternateEditGroup>;
  /** News / TV / film: YouTube id of an additional upload to swap into the primary link. */
  promoteYouTubeId?: FormControl<string>;
}

/** One playable service row: page URL + optional image URL (same shape as episode `additionalUrls`). */
export type PlayableServiceLinkGroup = FormGroup<{
  url: FormControl<string>;
  image: FormControl<string>;
}>;

export type FilmTrailerEditGroup = FormGroup<{ id: FormControl<string>; title: FormControl<string> }>;

export type YouTubeAlternateEditGroup = FormGroup<{
  youTubeId: FormControl<string>;
  url: FormControl<string>;
  title: FormControl<string>;
  channelName: FormControl<string>;
}>;

/** IMDb title id: `tt` + 7–10 digits (the film PATCH rejects anything else). */
export const imdbIdPattern = /^tt\d{7,10}$/;

/** IMDb title page for an id, or '' when the id is blank / not a valid `tt` id. */
export function imdbTitleUrl(imdbId: string | null | undefined): string {
  const id = (imdbId ?? '').trim();
  return imdbIdPattern.test(id) ? `https://www.imdb.com/title/${id}/` : '';
}

/** TheTVDB series page for a numeric id, or '' when blank / not a positive whole number. */
export function tvdbSeriesUrl(tvdbId: string | number | null | undefined): string {
  const id = String(tvdbId ?? '').trim();
  return /^[1-9]\d*$/.test(id) ? `https://www.thetvdb.com/dereferrer/series/${id}` : '';
}

/** TheTVDB episode page for a numeric id, or '' when blank / not a positive whole number. */
export function tvdbEpisodeUrl(tvdbId: string | number | null | undefined): string {
  const id = String(tvdbId ?? '').trim();
  return /^[1-9]\d*$/.test(id) ? `https://www.thetvdb.com/dereferrer/episode/${id}` : '';
}

/** TMDB movie page for a numeric id, or '' when blank / not a positive whole number. */
export function tmdbMovieUrl(tmdbId: string | number | null | undefined): string {
  const id = String(tmdbId ?? '').trim();
  return /^[1-9]\d*$/.test(id) ? `https://www.themoviedb.org/movie/${id}` : '';
}

/** TMDB TV show page for a numeric id, or '' when blank / not a positive whole number. */
export function tmdbTvShowUrl(tmdbId: string | number | null | undefined): string {
  const id = String(tmdbId ?? '').trim();
  return /^[1-9]\d*$/.test(id) ? `https://www.themoviedb.org/tv/${id}` : '';
}

const digitsPattern = /^\d*$/;

/** Signed int32 max: server DTOs bind TMDB ids as `int?` (overflow fails model binding). */
export const int32Max = 2_147_483_647;

function idText(id: number | null | undefined): string {
  return id ? String(id) : '';
}

/** Form text for a numeric id patch: blank clears (`0`). */
function numericIdValue(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : Number(trimmed);
}

/**
 * Blank clears; otherwise digits only, and at most {@link int32Max} so the value fits a server `int?`.
 * `{ pattern: true }` for non-digits; `{ int32Max: true }` when above the bound.
 */
export function tmdbIdTextValidator(control: AbstractControl): ValidationErrors | null {
  const text = String(control.value ?? '').trim();
  if (text === '') {
    return null;
  }
  if (!/^\d+$/.test(text)) {
    return { pattern: true };
  }
  // Length gate first: huge digit strings lose Number precision before comparing to int32Max.
  if (text.length > 10 || Number(text) > int32Max) {
    return { int32Max: true };
  }
  return null;
}

/**
 * A playable link must be an absolute http(s) URL whose service key resolves (a known service, else a key derived from
 * the host, as the episode editor does); existing catalogue links pass as they are, whatever key they are stored under.
 */
export function playableLinkValidator(existing: ReadonlySet<string> = new Set()): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const text = (control.value ?? '').trim();
    if (!text || existing.has(text)) {
      return null;
    }
    const url = absoluteHttpUrl(text);
    if (!url) {
      return { playableLinkUrl: true };
    }
    return resolveServiceKey(url) ? null : { playableLinkService: true };
  };
}

/** Two links for one service would overwrite each other in the PATCH. */
export function playableLinksDistinctValidator(existing: ReadonlyMap<string, string> = new Map()): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const seen = new Set<string>();
    for (const row of (control as FormArray<PlayableServiceLinkGroup>).getRawValue()) {
      const value = (row.url ?? '').trim();
      const key = existing.get(value) ?? playableLinkKey(value);
      if (!key) {
        continue;
      }
      if (seen.has(key)) {
        return { playableLinkDuplicate: key };
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
export function playableLinkKey(value: string | null | undefined): string | undefined {
  const url = absoluteHttpUrl((value ?? '').trim());
  return url ? resolveServiceKey(url) ?? undefined : undefined;
}

/** Stored playable links (news / TV / film share `services`): URL text → the key it is stored under. */
export function playableExistingLinks(services: PlayableFieldsDto['services']): Map<string, string> {
  const links = new Map<string, string>();
  for (const [key, link] of Object.entries(services ?? {})) {
    const url = uriText(link?.url);
    if (url) links.set(url, key);
  }
  return links;
}

/** One Urls/Images row: absolute URL (+ optional image). Existing catalogue URLs skip re-validation. */
export function newPlayableLinkGroup(
  url = '',
  image = '',
  existing: ReadonlySet<string> = new Set()
): PlayableServiceLinkGroup {
  return new FormGroup({
    url: new FormControl(url, { nonNullable: true, validators: [playableLinkValidator(existing)] }),
    image: new FormControl(image, { nonNullable: true })
  });
}

/**
 * Like `Validators.required`, but whitespace-only counts as empty. Needed because `filmTrailerChanges` trims and
 * omits blank titles (`{ id }` only), so spaces-only would otherwise look savable while the server keeps the old title.
 */
export function requiredTrimmed(control: AbstractControl): ValidationErrors | null {
  return String(control.value ?? '').trim() ? null : { required: true };
}

export function newFilmTrailerGroup(id: string, title: string): FilmTrailerEditGroup {
  return new FormGroup({
    id: new FormControl(id, { nonNullable: true }),
    // Required (trim-aware): a blank/whitespace title is omitted from the patch (server keeps the old one).
    title: new FormControl(title, { nonNullable: true, validators: [requiredTrimmed] })
  });
}

/** A new additional-YouTube row must be a YouTube watch / share / embed / shorts URL. Existing rows have a youTubeId. */
export function youTubeUrlRequired(control: AbstractControl): ValidationErrors | null {
  const urlText = String(control.value ?? '').trim();
  if (!urlText) {
    return { required: true };
  }
  try {
    return youtubeVideoId(new URL(urlText)) ? null : { youTubeUrl: true };
  } catch {
    return { youTubeUrl: true };
  }
}

export function newYouTubeAlternateGroup(
  youTubeId = '',
  url = '',
  title = '',
  channelName = ''
): YouTubeAlternateEditGroup {
  return new FormGroup({
    youTubeId: new FormControl(youTubeId, { nonNullable: true }),
    url: new FormControl(url, { nonNullable: true, validators: youTubeId ? [] : [youTubeUrlRequired] }),
    title: new FormControl(title, { nonNullable: true }),
    channelName: new FormControl(channelName, { nonNullable: true })
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
    blueskyPosted: new FormControl(!!dto.blueskyPosted, { nonNullable: true }),
    ignored: new FormControl(!!dto.ignored, { nonNullable: true }),
    removed: new FormControl(!!dto.removed, { nonNullable: true }),
    explicit: new FormControl(!!dto.explicit, { nonNullable: true }),
    // DateTimeUtc arrives as Date via JsonDateInterceptor; never put a raw Date in the control.
    release: new FormControl(utcCalendarDateText(dto.release), { nonNullable: true }),
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
  // Film / TV / news all edit `services` via Urls + Images tabs (same wire shape as film PATCH).
  const existingLinks = playableExistingLinks(dto.services);
  const existingUrls = new Set(existingLinks.keys());
  controls.links = new FormArray(
    [...existingLinks.entries()].map(([url, key]) =>
      newPlayableLinkGroup(url, uriText(dto.services?.[key]?.image), existingUrls)
    ),
    { validators: [playableLinksDistinctValidator(existingLinks)] }
  );
  if (variant === 'film') {
    const film = dto as FilmDto;
    // Read-only name: no required marker, and never part of validity or the PATCH.
    controls.title.clearValidators();
    controls.title.disable();
    controls.release.addValidators(Validators.pattern(filmReleasePattern));
    controls.publisher = new FormControl(film.publisher ?? '', { nonNullable: true });
    controls.imdbId = new FormControl(film.imdbId ?? '', {
      nonNullable: true,
      validators: [Validators.pattern(imdbIdPattern)]
    });
    controls.tmdbId = new FormControl(idText(film.tmdbId), {
      nonNullable: true,
      validators: [tmdbIdTextValidator]
    });
    controls.trailers = new FormArray(
      (film.trailers ?? []).map(trailer => newFilmTrailerGroup(trailer.id, trailer.title ?? ''))
    );
    controls.alternativeTitles = new FormControl((film.alternativeTitles ?? []).join('\n'), { nonNullable: true });
    controls.image = new FormControl(uriText(film.image), { nonNullable: true });
  } else if (variant === 'tv') {
    const tv = dto as TvShowEpisodeDto;
    controls.imdbId = new FormControl(tv.imdbId ?? '', {
      nonNullable: true,
      validators: [Validators.pattern(imdbIdPattern)]
    });
    controls.tvdbId = new FormControl(idText(tv.tvdbId), {
      nonNullable: true,
      validators: [Validators.pattern(digitsPattern)]
    });
    controls.tmdbId = new FormControl(idText(tv.tmdbId), {
      nonNullable: true,
      validators: [tmdbIdTextValidator]
    });
  }
  controls.additionalYouTube = new FormArray(
    (dto.additionalYouTube ?? []).map(item =>
      newYouTubeAlternateGroup(item.youTubeId, uriText(item.url), item.title ?? '', item.channelName ?? '')
    )
  );
  controls.promoteYouTubeId = new FormControl('', { nonNullable: true });
  return new FormGroup<PlayableEditForm>(controls);
}

function sameStrings(a: readonly string[] | null | undefined, b: readonly string[] | null | undefined): boolean {
  const left = a ?? [];
  const right = b ?? [];
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * Only the changed playable fields, in the PATCH wire shape. Blank title / release / duration are
 * never sent (the API cannot clear them). Bluesky mirrors Tweeted via `blueskyPosted`.
 */
export function playableFieldsChanges(
  previous: PlayableFieldsDto,
  next: PlayableEditFormValue
): PlayableFieldsChangeRequest {
  const changes: PlayableFieldsChangeRequest = {};
  const title = String(next.title ?? '').trim();
  if (title && title !== previous.title) changes.title = title;
  if (next.description !== (previous.description ?? '')) changes.description = next.description;
  const release = releaseFormText(next.release);
  if (release && release !== releaseFormText(previous.release)) changes.release = release;
  const duration = String(next.duration ?? '').trim();
  if (duration && duration !== (previous.duration ?? '')) changes.duration = duration;
  if (next.posted !== !!previous.posted) changes.posted = next.posted;
  if (next.tweeted !== !!previous.tweeted) changes.tweeted = next.tweeted;
  if (next.blueskyPosted !== !!previous.blueskyPosted) changes.blueskyPosted = next.blueskyPosted;
  if (next.explicit !== !!previous.explicit) changes.explicit = next.explicit;
  if (next.ignored !== !!previous.ignored) changes.ignored = next.ignored;
  if (next.removed !== !!previous.removed) changes.removed = next.removed;
  if (!sameStrings(previous.subjects, next.subjects)) changes.subjects = [...next.subjects];
  const searchTerms = String(next.searchTerms ?? '').trim();
  if (searchTerms !== (previous.searchTerms ?? '').trim()) changes.searchTerms = searchTerms;
  const hashTag = ensureHashPrefix(next.hashTag);
  if (hashTag !== ensureHashPrefix(previous.hashTag)) changes.hashTag = hashTag;
  if (!sameStrings(previous.guests, next.guests)) changes.guests = [...next.guests];
  const lang = episodeLanguageFormValue(next.lang === 'unset' ? null : next.lang);
  if (lang !== episodeLanguageFormValue(previous.language)) changes.language = lang === 'unset' ? '' : lang;
  if (next.links !== undefined) {
    const services = playableServiceChanges(previous.services, next.links);
    if (services) changes.services = services;
  }
  Object.assign(changes, youTubeAlternateChangeFields(previous, next.additionalYouTube, next.promoteYouTubeId));
  return changes;
}

/**
 * Keep-list / promote fields for additional YouTube. Unchanged list and a blank promote are omitted.
 * `expectedAdditionalYouTubeIds` is the list this editor loaded, so a later upload is a 409 instead of a delete.
 */
export function youTubeAlternateChangeFields(
  previous: { additionalYouTube?: { youTubeId: string; title?: string | null; channelName?: string | null }[] | null },
  nextAdditional: readonly { youTubeId: string; url: string; title: string; channelName: string }[] | undefined,
  promoteYouTubeId: string | undefined
): Pick<PlayableFieldsChangeRequest, 'additionalYouTube' | 'expectedAdditionalYouTubeIds' | 'promoteYouTubeId'> {
  const fields: Pick<PlayableFieldsChangeRequest, 'additionalYouTube' | 'expectedAdditionalYouTubeIds' | 'promoteYouTubeId'> = {};
  if (nextAdditional === undefined && promoteYouTubeId === undefined) {
    return fields;
  }
  const list = nextAdditional === undefined ? null : filmYouTubeAlternateChanges(previous, nextAdditional);
  const promote = (promoteYouTubeId ?? '').trim();
  if (list) {
    fields.additionalYouTube = list;
    fields.expectedAdditionalYouTubeIds = (previous.additionalYouTube ?? []).map(item => item.youTubeId);
  }
  if (promote) {
    fields.promoteYouTubeId = promote;
  }
  return fields;
}

/** Playable fields plus the Identity tab ids (omit = unchanged; `imdbId: ''`, `tvdbId: 0`, `tmdbId: 0` clear). */
export function tvShowEpisodeChanges(
  previous: TvShowEpisodeDto,
  next: PlayableEditFormValue
): TvShowEpisodeChangeRequest {
  const changes: TvShowEpisodeChangeRequest = playableFieldsChanges(previous, next);
  if (next.imdbId !== undefined) {
    const imdbId = next.imdbId.trim();
    if (imdbId !== (previous.imdbId ?? '')) changes.imdbId = imdbId;
  }
  if (next.tvdbId !== undefined) {
    const tvdbId = numericIdValue(next.tvdbId);
    if (tvdbId !== (previous.tvdbId ?? 0)) changes.tvdbId = tvdbId;
  }
  if (next.tmdbId !== undefined) {
    const tmdbId = numericIdValue(next.tmdbId);
    if (tmdbId !== (previous.tmdbId ?? 0)) changes.tmdbId = tmdbId;
  }
  return changes;
}

/**
 * Film PATCH body: the changed playable fields without `title` (the film PATCH has none; renames are admin-only),
 * plus `publisher` (`''` clears) and the identity ids (`imdbId`, `tmdbId`).
 */
export function filmChanges(
  previous: FilmDto,
  next: PlayableEditFormValue
): FilmChangeRequest {
  const { title: _title, ...changes }: PlayableFieldsChangeRequest = playableFieldsChanges(previous, next);
  const film: FilmChangeRequest = changes;
  const publisher = (next.publisher ?? '').trim();
  if (next.publisher !== undefined && publisher !== (previous.publisher ?? '').trim()) film.publisher = publisher;
  if (next.imdbId !== undefined) {
    const imdbId = next.imdbId.trim();
    if (imdbId !== (previous.imdbId ?? '')) film.imdbId = imdbId;
  }
  if (next.tmdbId !== undefined) {
    const tmdbId = numericIdValue(next.tmdbId);
    if (tmdbId !== (previous.tmdbId ?? 0)) film.tmdbId = tmdbId;
  }
  if (next.alternativeTitles !== undefined) {
    const titles = alternativeTitleLines(next.alternativeTitles);
    if (!sameStrings(titles, alternativeTitleLines((previous.alternativeTitles ?? []).join('\n')))) {
      film.alternativeTitles = titles;
    }
  }
  if (next.image !== undefined) {
    const image = next.image.trim();
    if (image !== uriText(previous.image).trim()) film.image = image;
  }
  // `services` and additional YouTube are already folded into playableFieldsChanges.
  if (next.trailers !== undefined) {
    const trailers = filmTrailerChanges(previous, next.trailers);
    if (trailers) {
      film.trailers = trailers;
      // The ids this form was built from, not the keep-list. A trailer attached after that is absent here, and the
      // server rejects the patch instead of deleting it.
      film.expectedTrailerIds = (previous.trailers ?? []).map(trailer => trailer.id);
    }
  }
  return film;
}

/**
 * The film's other titles from the Identity tab text: one per line, trimmed, blanks and repeats (case-insensitive)
 * dropped, first spelling kept. The server also drops the film's own name.
 */
export function alternativeTitleLines(text: string | null | undefined): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const line of (text ?? '').split(/\r?\n/)) {
    const title = line.trim();
    const key = title.toLocaleLowerCase();
    if (title && !seen.has(key)) {
      seen.add(key);
      titles.push(title);
    }
  }
  return titles;
}

/**
 * The playable `services` patch (news / TV / film): each link files under the key its URL resolves to (as the
 * server does); a key that no link resolves to any more is removed (`url` and `image` blank). Diffs `url` and
 * `image` independently (emit only changed members) so image-only edits do not wipe `url` and vice versa.
 * Null when unchanged.
 */
export function playableServiceChanges(
  previous: PlayableFieldsDto['services'],
  links: readonly { url: string; image?: string }[]
): Record<string, { url?: string; image?: string }> | null {
  const existing = playableExistingLinks(previous);
  const beforeUrl = new Map<string, string>([...existing].map(([url, key]) => [key, url]));
  const beforeImage = new Map<string, string>();
  for (const [key, link] of Object.entries(previous ?? {})) {
    beforeImage.set(key, uriText(link?.image));
  }
  const afterUrl = new Map<string, string>();
  const afterImage = new Map<string, string>();
  for (const row of links) {
    const url = (row.url ?? '').trim();
    // An unchanged link keeps the key it is stored under; a new one files under the key its URL resolves to.
    const key = existing.get(url) ?? playableLinkKey(url);
    if (key) {
      afterUrl.set(key, url);
      afterImage.set(key, (row.image ?? '').trim());
    }
  }
  const changes: Record<string, { url?: string; image?: string }> = {};
  for (const [key, url] of afterUrl) {
    const prevUrl = beforeUrl.get(key);
    const prevImage = beforeImage.get(key) ?? '';
    const image = afterImage.get(key) ?? '';
    const entry: { url?: string; image?: string } = {};
    if (prevUrl !== url) entry.url = url;
    if (prevImage !== image) entry.image = image;
    if (Object.keys(entry).length > 0) changes[key] = entry;
  }
  for (const key of beforeUrl.keys()) {
    if (!afterUrl.has(key)) changes[key] = { url: '', image: '' };
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

/** The `additionalYouTube` patch (keep / order / add-by-url / rename), or null when unchanged. */
export function filmYouTubeAlternateChanges(
  previous: { additionalYouTube?: { youTubeId: string; title?: string | null; channelName?: string | null }[] | null },
  next: readonly { youTubeId: string; url: string; title: string; channelName: string }[]
): { youTubeId?: string; url?: string; title?: string; channelName?: string }[] | null {
  const before = previous.additionalYouTube ?? [];
  const unchanged = before.length === next.length &&
    next.every((row, index) => {
      const item = before[index];
      return !!item
        && row.youTubeId.trim() === item.youTubeId
        && row.title.trim() === (item.title ?? '')
        && row.channelName.trim() === (item.channelName ?? '');
    });
  if (unchanged) {
    return null;
  }
  return next.map(row => {
    const youTubeId = row.youTubeId.trim();
    const title = row.title.trim();
    const channelName = row.channelName.trim();
    if (youTubeId) {
      const entry: { youTubeId?: string; url?: string; title?: string; channelName?: string } = { youTubeId };
      const prev = before.find(item => item.youTubeId === youTubeId);
      if (title && title !== (prev?.title ?? '')) {
        entry.title = title;
      }
      if (channelName && channelName !== (prev?.channelName ?? '')) {
        entry.channelName = channelName;
      }
      return entry;
    }
    return {
      url: row.url.trim(),
      ...(title ? { title } : {}),
      ...(channelName ? { channelName } : {})
    };
  });
}

