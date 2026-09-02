import { SimplePodcast } from './simple-podcast.interface';

export interface SubmitSeriesSelection {
  podcastId: string | undefined;
  podcastName: string | undefined;
}

/** Series picker (attach/create show) is curator-only; everyone else submits URL-only. */
export function showSubmitSeriesPicker(roles: readonly string[] | null | undefined): boolean {
  return !!roles?.includes('Curator');
}

/**
 * Maps the submit-dialog Series field onto /submit query params.
 * Autocomplete object → id + name; typed string → name only; empty → URL-only submit.
 */
export function submitSeriesFromForm(
  podcast: string | SimplePodcast | null | undefined
): SubmitSeriesSelection {
  if (podcast == null || podcast === '') {
    return { podcastId: undefined, podcastName: undefined };
  }
  if (typeof podcast === 'string') {
    const podcastName = podcast.trim();
    return { podcastId: undefined, podcastName: podcastName || undefined };
  }
  return { podcastId: podcast.id, podcastName: podcast.name };
}
