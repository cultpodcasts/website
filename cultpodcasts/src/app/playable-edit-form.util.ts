import { FormControl, FormGroup, Validators } from '@angular/forms';
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
}

/** Film release: a year `yyyy` or a calendar date `yyyy-MM-dd` (anything else is a 400 from the film PATCH). */
export const filmReleasePattern = /^\d{4}(-\d{2}-\d{2})?$/;

/** json-url.interceptor turns absolute URL strings in API bodies into `URL` objects. */
function uriText(value: string | URL | null | undefined): string {
  return value == null ? '' : value.toString();
}

export type PlayableEditFormValue = ReturnType<FormGroup<PlayableEditForm>['getRawValue']>;

export interface PlayableEditFormOptions {
  /** TV: IMDb + TheTVDB controls. */
  identity?: boolean;
  /** Film: IMDb (no TheTVDB) + publisher, read-only title, year-or-date release. */
  film?: boolean;
}

export function buildPlayableEditForm(dto: PlayableFieldsDto, options: PlayableEditFormOptions = {}): FormGroup<PlayableEditForm> {
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
  if (options.film) {
    const film = dto as FilmDto;
    // Read-only name: no required marker, and never part of validity or the PATCH.
    controls.title.clearValidators();
    controls.title.disable();
    controls.release.addValidators(Validators.pattern(filmReleasePattern));
    controls.imdb = new FormControl(uriText(film.imdb), { nonNullable: true });
    controls.publisher = new FormControl(film.publisher ?? '', { nonNullable: true });
  } else if (options.identity) {
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
  return film;
}
