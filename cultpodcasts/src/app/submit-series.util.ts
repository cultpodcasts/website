import { SimplePodcast } from './simple-podcast.interface';
import { Suggestion } from './search-suggestions.interface';
import { SubmittablePodcastUrlKind } from './podcast-url-matcher';
import { SubmitUrlLookupResponse } from './submit-url-lookup.interface';

export interface SubmitSeriesSelection {
  podcastId: string | undefined;
  podcastName: string | undefined;
}

export type SubmitSeriesFormValue = string | SimplePodcast | Suggestion | null | undefined;

export type SubmitSeriesUiMode = 'hide' | 'readonly' | 'picker';

/** What Save should do once lookup has completed for the current URL. */
export type SubmitDialogResult =
  | { kind: 'close'; url: string; podcast: string | undefined }
  | { kind: 'ambiguous'; podcastIds: string[] }
  | { kind: 'resolve-name'; seriesName: string };

/** Series picker (attach/create show) is curator-only; everyone else submits URL-only. */
export function showSubmitSeriesPicker(roles: readonly string[] | null | undefined): boolean {
  return !!roles?.includes('Curator');
}

/**
 * Add Podcast Series field from URL membership lookup.
 * Known unique → read-only name (do not send podcastName).
 * Unknown streaming or ambiguous → picker.
 * Unknown podcast-service / unrecognised / pending → hide.
 */
export function submitSeriesUiFromLookup(
  lookup: SubmitUrlLookupResponse | 'error' | 'pending' | null,
  clientKind: SubmittablePodcastUrlKind | undefined
): SubmitSeriesUiMode {
  if (!clientKind) {
    return 'hide';
  }
  if (lookup && lookup !== 'error' && lookup !== 'pending') {
    if (lookup.known) {
      return 'readonly';
    }
    if (lookup.ambiguous) {
      return 'picker';
    }
    if (lookup.kind === 'streaming') {
      return 'picker';
    }
    return 'hide';
  }
  if (lookup === 'error') {
    return clientKind === 'streaming' ? 'picker' : 'hide';
  }
  return 'hide';
}

/** Save is allowed only after lookup finished for this exact parsed href. */
export function submitLookupReadyForSave(
  parsedHref: string | undefined,
  lookedUpHref: string | null,
  pending: boolean
): boolean {
  return !!parsedHref && !pending && lookedUpHref === parsedHref;
}

/** Non-Curator Save needs a valid URL only — lookup is never called. Page-attach is URL capture only. */
export function submitSaveReady(
  isCurator: boolean,
  parsedHref: string | undefined,
  lookedUpHref: string | null,
  pending: boolean,
  urlCaptureOnly = false
): boolean {
  if (!parsedHref) {
    return false;
  }
  if (!isCurator || urlCaptureOnly) {
    return true;
  }
  return submitLookupReadyForSave(parsedHref, lookedUpHref, pending);
}

/**
 * Close / resolve plan for Add Podcast Save after lookup for this URL finished.
 * Known unique → URL-only (never send leftover podcastName).
 * Ambiguous 200 → picker from podcastIds (never URL-only).
 * Unknown podcast-service → URL-only even if Series still has text.
 * Unknown streaming + typed name → resolve by name.
 * Unknown streaming + empty Series → persist Isolated scrape `podcastName` (same as homepage Curator drop).
 */
export function submitDialogResult(
  url: string,
  lookup: SubmitUrlLookupResponse | 'error' | null,
  seriesForm: SubmitSeriesFormValue
): SubmitDialogResult {
  const urlOnly = (): SubmitDialogResult => ({ kind: 'close', url, podcast: undefined });

  if (lookup && lookup !== 'error') {
    if (lookup.known) {
      return urlOnly();
    }
    if (lookup.ambiguous) {
      return { kind: 'ambiguous', podcastIds: lookup.podcastIds };
    }
    if (lookup.kind === 'podcast-service') {
      return urlOnly();
    }
  }

  const seriesName = seriesNameFromForm(seriesForm);
  if (seriesName) {
    return { kind: 'resolve-name', seriesName };
  }
  if (lookup && lookup !== 'error' && lookup.kind === 'streaming') {
    const extracted = lookup.podcastName?.trim();
    if (extracted) {
      return { kind: 'close', url, podcast: extracted };
    }
  }
  return urlOnly();
}

/** Autocomplete `displayWith`: suggestion uses `label`, SimplePodcast uses `name`. */
export function displaySeriesFormValue(podcast: SubmitSeriesFormValue): string {
  if (podcast == null || podcast === '') {
    return '';
  }
  if (typeof podcast === 'string') {
    return podcast;
  }
  if ('label' in podcast) {
    return podcast.label || podcast.value || '';
  }
  return podcast.name ?? '';
}

export function seriesNameFromForm(podcast: SubmitSeriesFormValue): string | undefined {
  if (podcast == null || podcast === '') {
    return undefined;
  }
  if (typeof podcast === 'string') {
    const name = podcast.trim();
    return name || undefined;
  }
  if ('id' in podcast && podcast.id) {
    const name = podcast.name?.trim();
    return name || undefined;
  }
  const name = (podcast as Suggestion).value?.trim();
  return name || undefined;
}

/**
 * Maps the submit-dialog Series field onto /submit query params.
 * Object with id → id + name; typed string / typeahead suggestion → name only; empty → URL-only submit.
 */
export function submitSeriesFromForm(podcast: SubmitSeriesFormValue): SubmitSeriesSelection {
  if (podcast == null || podcast === '') {
    return { podcastId: undefined, podcastName: undefined };
  }
  if (typeof podcast === 'string') {
    const podcastName = podcast.trim();
    return { podcastId: undefined, podcastName: podcastName || undefined };
  }
  if ('id' in podcast && podcast.id) {
    return { podcastId: podcast.id, podcastName: podcast.name };
  }
  return { podcastId: undefined, podcastName: seriesNameFromForm(podcast) };
}

/** POST /submit always includes the episode url; 409 is a name collision for that same url. */
export function submitEpisodePostBody(url: URL, series: SubmitSeriesSelection): {
  url: string;
  podcastId: string | undefined;
  podcastName: string | undefined;
} {
  return {
    url: url.href,
    podcastId: series.podcastId,
    podcastName: series.podcastName
  };
}
