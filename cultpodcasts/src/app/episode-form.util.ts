import { FormControl, FormGroup } from '@angular/forms';
import { ApiEpisode } from './api-episode.interface';
import { EpisodeForm } from './episode-form.interface';
import { EpisodePost } from './episode-post.interface';
import { Person } from './person.interface';
import { Subject } from './subject.interface';
import { filterKeepingSelectedInOrder } from './subject-filter.util';

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

export function personLabel(person: Person): string {
  const handles = [person.twitterHandle, person.blueskyHandle].filter(x => !!x).join(' ');
  return handles ? `${person.name} (${handles})` : person.name;
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
    lang: new FormControl(episode.lang || 'unset'),
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
  const selectedGuests = selectedNames
    .map(name => peopleByName.get(name))
    .filter((x): x is Person => !!x);

  const otherNames = allPeople
    .map(person => person.name)
    .filter(name => !selectedSet.has(name));
  const filteredOtherNames = filterKeepingSelectedInOrder(otherNames, filterTerm, selectedSet);
  const otherPeople = filteredOtherNames
    .map(name => peopleByName.get(name))
    .filter((x): x is Person => !!x);

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
  if ((prev.bluesky ?? false) != (now.bluesky ?? false)) changes.bluesky = now.bluesky ?? false;
  if (prev.release.toISOString() != nowReleaseDate) changes.release = nowReleaseDate;
  if (prev.removed != now.removed) changes.removed = now.removed;
  if (prev.searchTerms != now.searchTerms) changes.searchTerms = now.searchTerms;
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
  if (!areEqualUrlValue(prev.lang ?? 'unset', now.lang ?? 'unset')) changes.lang = now.lang == 'unset' ? '' : now.lang ?? '';
  if (!isSameStringArray(prev.guests, now.guests)) changes.guests = now.guests;
  return changes;
}
