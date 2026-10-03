import { TvShowEpisodeCanonicalChangeRequest } from './tv-show-episode-canonical.interface';

function normalizedCanonicalUri(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function canonicalUriPatch(
  previous: string | null | undefined,
  next: string | null | undefined
): string | undefined {
  const from = normalizedCanonicalUri(previous);
  const to = normalizedCanonicalUri(next);
  if (from === to) {
    return undefined;
  }
  return to;
}

/** Builds an omit / empty-string-clear / URL-set identity POST body from GET vs form values. */
export function buildTvShowEpisodeCanonicalChangeRequest(
  previous: { imdb?: string | null; tvdb?: string | null },
  form: { imdb?: string | null; tvdb?: string | null }
): TvShowEpisodeCanonicalChangeRequest {
  const changes: TvShowEpisodeCanonicalChangeRequest = {};
  const imdb = canonicalUriPatch(previous.imdb, form.imdb);
  const tvdb = canonicalUriPatch(previous.tvdb, form.tvdb);
  if (imdb !== undefined) {
    changes.imdb = imdb;
  }
  if (tvdb !== undefined) {
    changes.tvdb = tvdb;
  }
  return changes;
}
