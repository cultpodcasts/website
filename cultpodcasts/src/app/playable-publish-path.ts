import { CataloguePlayableKind } from './catalogue-playable-kind.enum';

/**
 * Curator publish POST path for the Worker / api-infra.
 * Catalogue kinds use kind-prefixed routes; podcast episodes stay on guid-only `/episode/publish/:id`.
 */
export function playablePublishPath(
  playableId: string,
  contentKind: string | null | undefined
): string {
  const id = encodeURIComponent(playableId);
  switch (contentKind) {
    case CataloguePlayableKind.Film:
      return `/film/${id}/publish`;
    case CataloguePlayableKind.NewsReport:
      return `/newsreport/${id}/publish`;
    case CataloguePlayableKind.TvShowEpisode:
      return `/tvshowepisode/${id}/publish`;
    default:
      return `/episode/publish/${id}`;
  }
}
