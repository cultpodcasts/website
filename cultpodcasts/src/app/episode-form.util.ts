import { FormControl, FormGroup } from '@angular/forms';
import { ApiEpisode } from './api-episode.interface';
import { EpisodeForm } from './episode-form.interface';
import { EpisodePost } from './episode-post.interface';
import { episodeLanguageFormValue } from './language-options.util';
import { Person } from './person.interface';
import { comparePeopleBySortKey } from './person-sort';
import { Subject } from './subject.interface';
import { filterKeepingSelectedInOrder } from './subject-filter.util';
import { ensureHashPrefix, hashPrefixedTagValidator } from './podcast-form.util';

/**
 * Pure helpers shared by add-episode-dialog and edit-episode-dialog.
 * Kept free of HttpClient/Auth0/dialog concerns so they stay easily testable;
 * dialog-specific wiring (loading, submit payload assembly, close semantics) stays in the dialogs.
 */

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

export function dateToLocalISO(date: Date): string {
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60 * 1000).toISOString().substring(0, 23);
}

export function noCompareFunction(): number {
  return 0;
}

export function hasNonEmptyUrlValue(value: string | URL | null | undefined): boolean {
  if (value instanceof URL) {
    return true;
  }
  return !!value?.trim();
}

/** Opens a trimmed absolute URL in a new tab; no-ops on blank or invalid values. */
export function openExternalUrl(value: string | URL | null | undefined): void {
  if (value instanceof URL) {
    window.open(value.toString(), '_blank', 'noopener,noreferrer');
    return;
  }
  const trimmed = value?.trim();
  if (!trimmed) {
    return;
  }
  try {
    const url = new URL(trimmed);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  } catch {
    // Invalid URL — leave the field as-is for the curator to fix.
  }
}

export function clearFormControl(control: FormControl<string | URL | null>): void {
  control.setValue(null);
  control.markAsDirty();
}

export type EpisodeImageService = 'spotify' | 'apple' | 'youtube' | 'other';

export interface EpisodeImagePreviewItem {
  service: EpisodeImageService;
  label: string;
  url: string;
}

/** Non-empty episode image fields in display order for the preview gallery. */
export function collectEpisodeImagePreviews(form: FormGroup<EpisodeForm>): EpisodeImagePreviewItem[] {
  const items: EpisodeImagePreviewItem[] = [];
  const add = (service: EpisodeImageService, label: string, value: string | URL | null | undefined) => {
    const url = value instanceof URL ? value.toString() : value?.trim();
    if (url) {
      items.push({ service, label, url });
    }
  };
  add('spotify', 'Spotify', form.controls.spotifyImage.value);
  add('apple', 'Apple', form.controls.appleImage.value);
  add('youtube', 'YouTube', form.controls.youtubeImage.value);
  add('other', 'Other', form.controls.otherImage.value);
  return items;
}

export function personLabel(person: Person): string {
  const handles = [person.twitterHandle, person.blueskyHandle].filter(x => !!x).join(' ');
  return handles ? `${person.name} (${handles})` : person.name;
}

/** Match guest dropdown typing against name, sort name, aliases, or social handles. */
export function personMatchesFilter(person: Person, filterTerm: string): boolean {
  const trimmedTerm = filterTerm.trim().toLowerCase();
  if (!trimmedTerm) {
    return true;
  }
  const termWithoutAt = trimmedTerm.replace(/^@+/, '');
  const candidates = [
    person.name,
    person.sortName,
    ...(person.aliases ?? []),
    person.twitterHandle,
    person.blueskyHandle
  ].filter((x): x is string => !!x);

  return candidates.some(candidate => {
    const lower = candidate.toLowerCase();
    return lower.includes(trimmedTerm) || lower.replace(/^@+/, '').includes(termWithoutAt);
  });
}

export function buildEpisodeForm(episode: ApiEpisode): FormGroup<EpisodeForm> {
  return new FormGroup<EpisodeForm>({
    title: new FormControl(episode.title, { nonNullable: true }),
    description: new FormControl(episode.description, { nonNullable: true }),
    posted: new FormControl(episode.posted, { nonNullable: true }),
    tweeted: new FormControl(episode.tweeted, { nonNullable: true }),
    blueskyPosted: new FormControl(episode.bluesky ?? false, { nonNullable: true }),
    ignored: new FormControl(episode.ignored, { nonNullable: true }),
    explicit: new FormControl(episode.explicit, { nonNullable: true }),
    removed: new FormControl(episode.removed, { nonNullable: true }),
    release: new FormControl(dateToLocalISO(episode.release), { nonNullable: true }),
    duration: new FormControl(episode.duration, { nonNullable: true }),
    spotify: new FormControl(episode.urls.spotify || null),
    spotifyImage: new FormControl(episode.images?.spotify || null),
    apple: new FormControl(episode.urls.apple || null),
    appleImage: new FormControl(episode.images?.apple || null),
    youtube: new FormControl(episode.urls.youtube || null),
    youtubeImage: new FormControl(episode.images?.youtube || null),
    otherImage: new FormControl(episode.images?.other || null),
    bbc: new FormControl(episode.urls.bbc || null),
    internetArchive: new FormControl(episode.urls.internetArchive || null),
    subjects: new FormControl(episode.subjects, { nonNullable: true }),
    searchTerms: new FormControl(episode.searchTerms || null),
    hashTag: new FormControl(ensureHashPrefix(episode.hashTag) || null, {
      validators: [hashPrefixedTagValidator()]
    }),
    lang: new FormControl(episodeLanguageFormValue(episode.lang)),
    guests: new FormControl<string[]>(episode.guests ?? [], { nonNullable: true })
  });
}

export function mergeEpisodeSubjects(
  episodeSubjects: string[],
  allSubjectOptions: Subject[],
  podcastDefaultSubject: string | null
): { subjects: string[]; allSubjects: string[] } {
  const subjects = episodeSubjects.concat(
    allSubjectOptions.filter(x => !episodeSubjects.includes(x.name)).map(x => x.name)
  );
  const allSubjects = uniqueStrings(subjects.concat(podcastDefaultSubject ? [podcastDefaultSubject] : []));
  return { subjects, allSubjects };
}

export interface RegroupedSubjects {
  selectedSubjects: string[];
  hoistedSubjects: string[];
  otherSubjects: string[];
}

export function regroupSubjects(
  selected: string[] | null | undefined,
  allSubjects: string[],
  podcastDefaultSubject: string | null,
  hoistedSubjectNames: string[],
  filterTerm: string
): RegroupedSubjects {
  const selectedValues = uniqueStrings(selected ?? []);
  const selectedSet = new Set(selectedValues);
  const selectedSubjects = selectedValues.filter(subject => allSubjects.includes(subject));

  let hoistedSubjects: string[] = [];
  if (podcastDefaultSubject) {
    hoistedSubjects.push(podcastDefaultSubject);
  }

  const orderedHoistedNames = uniqueStrings([...hoistedSubjectNames]);

  const remainingHoistedSubjects = orderedHoistedNames.filter(subject =>
    allSubjects.includes(subject)
    && !selectedSet.has(subject)
    && subject !== podcastDefaultSubject
  );
  hoistedSubjects = hoistedSubjects.concat(remainingHoistedSubjects);

  const hoistedSet = new Set(hoistedSubjects);
  let otherSubjects = allSubjects.filter(subject => !selectedSet.has(subject) && !hoistedSet.has(subject));

  hoistedSubjects = filterKeepingSelectedInOrder(hoistedSubjects, filterTerm, selectedSet);
  otherSubjects = filterKeepingSelectedInOrder(otherSubjects, filterTerm, selectedSet);

  return { selectedSubjects, hoistedSubjects, otherSubjects };
}

export interface RegroupedGuests {
  selectedGuests: Person[];
  otherPeople: Person[];
}

export function isPendingPersonId(id: string | undefined): boolean {
  return !id || id.startsWith('pending:');
}

export function pendingPerson(name: string): Person {
  return { id: `pending:${name}`, name };
}

/**
 * Merge people lists by name. Existing locals are kept when a fetched snapshot
 * is stale (GET /people is an R2 publish, often HTTP-cached). Pending stubs
 * never overwrite a real person.
 */
export function mergePeopleCatalogue(
  existing: Person[],
  fetched: Person[] | undefined,
  extras: Person[] = []
): Person[] {
  const byName = new Map<string, Person>();

  const put = (person: Person | undefined, mode: 'replace' | 'fill') => {
    const name = person?.name?.trim();
    if (!name || !person) {
      return;
    }
    const current = byName.get(name);
    if (!current) {
      byName.set(name, person);
      return;
    }
    if (mode === 'fill') {
      return;
    }
    byName.set(name, person);
  };

  for (const person of existing) {
    put(person, 'replace');
  }
  for (const person of fetched ?? []) {
    put(person, 'replace');
  }
  for (const person of extras) {
    put(person, isPendingPersonId(person.id) ? 'fill' : 'replace');
  }

  return [...byName.values()].sort(comparePeopleBySortKey);
}

export function catalogueAfterPersonChange(
  existing: Person[],
  fetched: Person[] | undefined,
  personName: string,
  created?: Person
): Person[] {
  const extra = created?.name?.trim()
    ? created
    : pendingPerson(personName);
  return mergePeopleCatalogue(existing, fetched, [extra]);
}

export function guestNamesWithPerson(
  current: string[] | null | undefined,
  personName: string
): string[] {
  const names = uniqueStrings(current ?? []);
  return names.includes(personName) ? names : [...names, personName];
}

/** Published catalogue plus episode guests and title/description suggestions. */
export function episodeCataloguePeople(
  published: Person[],
  guestPeople?: Person[],
  suggestions?: { person: Person }[]
): Person[] {
  return mergePeopleCatalogue(published, undefined, [
    ...(guestPeople ?? []),
    ...(suggestions ?? []).map(x => x.person)
  ]);
}

export interface ApplyGuestSelectionInput {
  allPeople: Person[];
  /** Optional GET /people snapshot (may be stale / cached). */
  fetched?: Person[];
  currentGuests: string[] | null | undefined;
  personName: string;
  person?: Person;
  episodeGuestPeople?: Person[];
  filterTerm?: string;
}

export interface ApplyGuestSelectionResult extends RegroupedGuests {
  allPeople: Person[];
  guests: string[];
}

/**
 * Dialog contract for create-person / suggestion Add: merge into catalogue,
 * append the guest name, then regroup so Material select has matching options
 * before setValue.
 */
export function applyGuestSelection(input: ApplyGuestSelectionInput): ApplyGuestSelectionResult {
  const allPeople = catalogueAfterPersonChange(
    input.allPeople,
    input.fetched,
    input.personName,
    input.person
  );
  const guests = guestNamesWithPerson(input.currentGuests, input.personName);
  const { selectedGuests, otherPeople } = regroupGuests(
    allPeople,
    input.episodeGuestPeople,
    guests,
    input.filterTerm ?? ''
  );
  return { allPeople, guests, selectedGuests, otherPeople };
}

export function withoutGuestSuggestion<T extends { person: { name: string } }>(
  suggestions: T[],
  personName: string
): T[] {
  return suggestions.filter(x => x.person.name !== personName);
}

export function regroupGuests(
  allPeople: Person[],
  episodeGuestPeople: Person[] | undefined,
  selected: string[] | null | undefined,
  filterTerm: string
): RegroupedGuests {
  const selectedNames = uniqueStrings(selected ?? []);
  const selectedSet = new Set(selectedNames);
  const peopleByName = new Map(allPeople.map(x => [x.name, x]));
  for (const guest of episodeGuestPeople ?? []) {
    peopleByName.set(guest.name, guest);
  }
  const selectedGuests = selectedNames.map(name =>
    peopleByName.get(name) ?? pendingPerson(name)
  );

  const otherPeople = allPeople
    .filter(person => !selectedSet.has(person.name))
    .filter(person => personMatchesFilter(person, filterTerm));

  return { selectedGuests, otherPeople };
}

function areEqualUrlValue(
  url1: URL | null | undefined | string,
  url2: URL | null | undefined | string
): boolean {
  if ((url1 == undefined || url1 == null) && (url2 == undefined || url2 == null)) {
    return true;
  }
  if ((url1 == undefined || url1 == null) && (url2 != undefined && url2 != null)) {
    return false;
  }
  if ((url2 == undefined || url2 == null) && (url1 != undefined && url1 != null)) {
    return false;
  }
  return url1!.toString() === url2!.toString();
}

function isSameStringArray(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  if (!a && !b) {
    return true;
  }
  if (!a && b?.length == 0) {
    return true;
  }
  if (a?.length == 0 && !b) {
    return true;
  }
  return JSON.stringify(a) == JSON.stringify(b);
}

export function getEpisodeChanges(prev: ApiEpisode, now: ApiEpisode): EpisodePost {
  const nowReleaseDate = new Date(now.release).toISOString();
  const changes: EpisodePost = {};
  if (prev.description != now.description) changes.description = now.description;
  if (prev.duration != now.duration) changes.duration = now.duration;
  if (prev.explicit != now.explicit) changes.explicit = now.explicit;
  if (prev.ignored != now.ignored) changes.ignored = now.ignored;
  if (prev.posted != now.posted) changes.posted = now.posted;
  if (prev.tweeted != now.tweeted) changes.tweeted = now.tweeted;
  if (prev.release.toISOString() != nowReleaseDate) changes.release = nowReleaseDate;
  if (prev.removed != now.removed) changes.removed = now.removed;
  if (prev.searchTerms != now.searchTerms) changes.searchTerms = now.searchTerms;
  if (prev.hashTag != now.hashTag) changes.hashTag = now.hashTag;
  if (!isSameStringArray(prev.subjects, now.subjects)) changes.subjects = now.subjects;
  if (prev.title != now.title) changes.title = now.title;

  if ((!areEqualUrlValue(prev.urls?.apple, now.urls?.apple)) ||
    (!areEqualUrlValue(prev.urls?.spotify, now.urls?.spotify)) ||
    (!areEqualUrlValue(prev.urls?.youtube, now.urls?.youtube)) ||
    (!areEqualUrlValue(prev.urls?.bbc, now.urls?.bbc)) ||
    (!areEqualUrlValue(prev.urls?.internetArchive, now.urls?.internetArchive))) {
    changes.urls = {};
  }
  if (!areEqualUrlValue(prev.urls?.apple, now.urls?.apple)) changes.urls!.apple = now.urls?.apple ?? '';
  if (!areEqualUrlValue(prev.urls?.spotify, now.urls?.spotify)) changes.urls!.spotify = now.urls?.spotify ?? '';
  if (!areEqualUrlValue(prev.urls?.youtube, now.urls?.youtube)) changes.urls!.youtube = now.urls?.youtube ?? '';
  if (!areEqualUrlValue(prev.urls?.bbc, now.urls?.bbc)) changes.urls!.bbc = now.urls?.bbc ?? '';
  if (!areEqualUrlValue(prev.urls?.internetArchive, now.urls?.internetArchive)) changes.urls!.internetArchive = now.urls?.internetArchive ?? '';

  if ((!areEqualUrlValue(prev.images?.apple, now.images?.apple)) ||
    (!areEqualUrlValue(prev.images?.spotify, now.images?.spotify)) ||
    (!areEqualUrlValue(prev.images?.youtube, now.images?.youtube)) ||
    (!areEqualUrlValue(prev.images?.other, now.images?.other))) {
    changes.images = {};
  }
  if (!areEqualUrlValue(prev.images?.apple, now.images?.apple)) changes.images!.apple = now.images?.apple ?? '';
  if (!areEqualUrlValue(prev.images?.spotify, now.images?.spotify)) changes.images!.spotify = now.images?.spotify ?? '';
  if (!areEqualUrlValue(prev.images?.youtube, now.images?.youtube)) changes.images!.youtube = now.images?.youtube ?? '';
  if (!areEqualUrlValue(prev.images?.other, now.images?.other)) changes.images!.other = now.images?.other ?? '';
  if (!areEqualUrlValue(prev.lang ?? 'unset', now.lang ?? 'unset')) {
    const next = episodeLanguageFormValue(now.lang);
    changes.lang = next === 'unset' ? '' : next;
  }
  if (!isSameStringArray(prev.guests, now.guests)) changes.guests = now.guests;
  return changes;
}
