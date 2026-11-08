import { CataloguePlayableKind } from './catalogue-playable-kind.enum';

/**
 * Curator soft-delete DELETE path for the Worker / api-infra.
 * Catalogue kinds use kind-prefixed routes; podcast episodes need podcastId + episodeId.
 * Returns null when Episode delete is requested without a podcastId.
 */
export function playableDeletePath(
  episodeId: string,
  contentKind: string | null | undefined,
  podcastId?: string | null
): string | null {
  const id = encodeURIComponent(episodeId);
  switch (contentKind) {
    case CataloguePlayableKind.Film:
      return `/film/${id}`;
    case CataloguePlayableKind.NewsReport:
      return `/newsreport/${id}`;
    case CataloguePlayableKind.TvShowEpisode:
      return `/tvshowepisode/${id}`;
    default: {
      if (!podcastId) {
        return null;
      }
      return `/episode/${encodeURIComponent(podcastId)}/${id}`;
    }
  }
}
