import { SimplePodcast } from './simple-podcast.interface';
import { Suggestion } from './search-suggestions.interface';

export interface SubmitSeriesSelection {
  podcastId: string | undefined;
  podcastName: string | undefined;
}

export type SubmitSeriesFormValue = string | SimplePodcast | Suggestion | null | undefined;

/** Series picker (attach/create show) is curator-only; everyone else submits URL-only. */
export function showSubmitSeriesPicker(roles: readonly string[] | null | undefined): boolean {
  return !!roles?.includes('Curator');
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
