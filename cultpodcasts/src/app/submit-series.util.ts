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
