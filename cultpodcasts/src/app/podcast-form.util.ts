import { FormControl } from '@angular/forms';
import { EditPodcastForm } from './edit-podcast-form.interface';
import { EditPodcastPost } from './edit-podcast-post.interface';
import { Podcast } from './podcast.interface';
import { PodcastServiceType } from './podcast-service-type.enum';

/**
 * Pure helpers shared by add-podcast-dialog and edit-podcast-dialog.
 * Kept free of HttpClient/Auth0/dialog concerns so they stay easily testable;
 * dialog-specific wiring (loading, submit payload assembly, conflict/not-found handling,
 * PUT vs POST, load-by-id vs load-by-name) stays in the dialogs.
 */

export function noCompareFunction(): number {
  return 0;
}

export function buildPodcastFormControls(podcast: Podcast): EditPodcastForm {
  return {
    removed: new FormControl(podcast.removed, { nonNullable: true }),
    indexAllEpisodes: new FormControl(podcast.indexAllEpisodes, { nonNullable: true }),
    bypassShortEpisodeChecking: new FormControl(podcast.bypassShortEpisodeChecking, { nonNullable: true }),
    releaseAuthority: new FormControl(podcast.releaseAuthority ?? PodcastServiceType[PodcastServiceType.Unset], { nonNullable: true }),
    primaryPostService: new FormControl(podcast.primaryPostService ?? PodcastServiceType[PodcastServiceType.Unset], { nonNullable: true }),
    spotifyId: new FormControl(podcast.spotifyId, { nonNullable: true }),
    appleId: new FormControl(podcast.appleId, { nonNullable: false }),
    youTubePublicationDelay: new FormControl(podcast.youTubePublicationDelay, { nonNullable: true }),
    skipEnrichingFromYouTube: new FormControl(podcast.skipEnrichingFromYouTube, { nonNullable: true }),
    twitterHandle: new FormControl(podcast.twitterHandle, { nonNullable: true }),
    blueskyHandle: new FormControl(podcast.blueskyHandle, { nonNullable: true }),
    titleRegex: new FormControl(podcast.titleRegex, { nonNullable: true }),
    descriptionRegex: new FormControl(podcast.descriptionRegex, { nonNullable: true }),
    episodeMatchRegex: new FormControl(podcast.episodeMatchRegex, { nonNullable: true }),
    episodeIncludeTitleRegex: new FormControl(podcast.episodeIncludeTitleRegex, { nonNullable: true }),
    defaultSubject: new FormControl(podcast.defaultSubject, { nonNullable: false }),
    ignoreAllEpisodes: new FormControl(podcast.ignoreAllEpisodes, { nonNullable: true }),
    youTubeChannelId: new FormControl(podcast.youTubeChannelId, { nonNullable: true }),
    youTubePlaylistId: new FormControl(podcast.youTubePlaylistId, { nonNullable: true }),
    ignoredAssociatedSubjects: new FormControl<string[]>(podcast.ignoredAssociatedSubjects ?? [], { nonNullable: true }),
    ignoredSubjects: new FormControl<string[]>(podcast.ignoredSubjects ?? [], { nonNullable: true }),
    lang: new FormControl(podcast.lang || 'unset', { nonNullable: true }),
    knownTerms: new FormControl<string[]>(podcast.knownTerms ?? [], { nonNullable: true }),
    minimumDuration: new FormControl(podcast.minimumDuration, { nonNullable: true }),
    enrichmentHashTags: new FormControl(podcast.enrichmentHashTags, { nonNullable: false }),
    hashTag: new FormControl(podcast.hashTag, { nonNullable: false }),
  };
}

export function translateForEntity(value: string | undefined | null): string | undefined {
  if (value) return value;
  return '';
}

export function translateForEntityA(value: string[] | string | undefined | null): string[] | undefined {
  if (value) {
    const valueAny: any = value;
    if (valueAny.push) {
      return value as string[];
    } else if (valueAny.split) {
      const valueString: string = valueAny;
      return valueString.split(',');
    }
  }
  return [];
}

export function filterSubjectsByTerm(subjects: string[], term: string): string[] {
  const trimmedTerm = term.trim().toLowerCase();
  if (!trimmedTerm) {
    return subjects;
  }
  return subjects.filter(subject => subject.toLowerCase().includes(trimmedTerm));
}

function isSameString(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a && !b) {
    return true;
  }
  return JSON.stringify(a) == JSON.stringify(b);
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

/**
 * Diffs two Podcast snapshots into an EditPodcastPost patch.
 * add-podcast-dialog additionally sets `podcastName` when the name changes (add-only field,
 * not present on EditPodcastPost), so it wraps this helper rather than duplicating the diff.
 */
export function getPodcastChanges(prev: Podcast, now: Podcast): EditPodcastPost {
  const changes: EditPodcastPost = {};
  if (prev.removed != now.removed) changes.removed = now.removed;
  if (prev.indexAllEpisodes != now.indexAllEpisodes) changes.indexAllEpisodes = now.indexAllEpisodes;
  if (prev.bypassShortEpisodeChecking != now.bypassShortEpisodeChecking) changes.bypassShortEpisodeChecking = now.bypassShortEpisodeChecking;
  if (prev.releaseAuthority != now.releaseAuthority && now.releaseAuthority) changes.releaseAuthority = now.releaseAuthority;
  if (prev.releaseAuthority != now.releaseAuthority && now.releaseAuthority == undefined) changes.unsetReleaseAuthority = true;
  if (prev.primaryPostService != now.primaryPostService && now.primaryPostService) changes.primaryPostService = now.primaryPostService;
  if (prev.primaryPostService != now.primaryPostService && now.primaryPostService == undefined) changes.unsetPrimaryPostService = true;
  if (prev.spotifyId != now.spotifyId) changes.spotifyId = now.spotifyId;
  if (!isSameStringArray(prev.enrichmentHashTags, now.enrichmentHashTags)) changes.enrichmentHashTags = now.enrichmentHashTags;
  if (!isSameString(prev.hashTag, now.hashTag)) changes.hashTag = now.hashTag;
  if (prev.removed != now.removed) changes.removed = now.removed;
  if (prev.appleId != now.appleId) {
    changes.appleId = now.appleId;
    if (now.appleId == null) {
      changes.nullAppleId = true;
    }
  }
  if (prev.youTubePublicationDelay != now.youTubePublicationDelay) changes.youTubePublicationDelay = now.youTubePublicationDelay;
  if (prev.skipEnrichingFromYouTube != now.skipEnrichingFromYouTube) changes.skipEnrichingFromYouTube = now.skipEnrichingFromYouTube;
  if (prev.twitterHandle != now.twitterHandle) changes.twitterHandle = now.twitterHandle;
  if (prev.blueskyHandle != now.blueskyHandle) changes.blueskyHandle = now.blueskyHandle;
  if (prev.titleRegex != now.titleRegex) changes.titleRegex = now.titleRegex;
  if (prev.descriptionRegex != now.descriptionRegex) changes.descriptionRegex = now.descriptionRegex;
  if (prev.episodeMatchRegex != now.episodeMatchRegex) changes.episodeMatchRegex = now.episodeMatchRegex;
  if (prev.episodeIncludeTitleRegex != now.episodeIncludeTitleRegex) changes.episodeIncludeTitleRegex = now.episodeIncludeTitleRegex;
  if (prev.defaultSubject != now.defaultSubject) changes.defaultSubject = now.defaultSubject ?? '';
  if (prev.ignoreAllEpisodes != now.ignoreAllEpisodes) changes.ignoreAllEpisodes = now.ignoreAllEpisodes;
  if (prev.youTubePlaylistId != now.youTubePlaylistId) changes.youTubePlaylistId = now.youTubePlaylistId;
  if (!isSameStringArray(prev.ignoredAssociatedSubjects, now.ignoredAssociatedSubjects)) changes.ignoredAssociatedSubjects = now.ignoredAssociatedSubjects;
  if (!isSameStringArray(prev.ignoredSubjects, now.ignoredSubjects)) changes.ignoredSubjects = now.ignoredSubjects;
  if (!areEqualUrlValue(prev.lang ?? 'unset', now.lang ?? 'unset')) changes.lang = now.lang == 'unset' ? '' : now.lang ?? '';
  if (!isSameStringArray(prev.knownTerms, now.knownTerms)) changes.knownTerms = now.knownTerms;
  if (!isSameString(prev.minimumDuration, now.minimumDuration)) changes.minimumDuration = now.minimumDuration;
  return changes;
}
