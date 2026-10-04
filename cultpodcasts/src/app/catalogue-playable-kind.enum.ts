/** Playable kinds on the submit-success wire (Azure / Worker OpenAPI). Not parent kinds. */
export enum CataloguePlayableKind {
  Episode = 'Episode',
  TvShowEpisode = 'TvShowEpisode',
  Film = 'Film',
  NewsReport = 'NewsReport',
}

const playableKindValues = new Set<string>(Object.values(CataloguePlayableKind));

/** True for all four playable wire values, including podcast `Episode`. */
export function isCataloguePlayableKindValue(
  contentKind: string | null | undefined
): contentKind is CataloguePlayableKind {
  return contentKind != null && playableKindValues.has(contentKind);
}

/**
 * TV / Film / News (and any later non-Episode playable).
 * False for podcast `Episode`, parents, and Movie — those are not catalogue snackbar / Review-block kinds.
 */
export function isNonPodcastPlayableKind(
  contentKind: string | null | undefined
): contentKind is Exclude<CataloguePlayableKind, CataloguePlayableKind.Episode> {
  return isCataloguePlayableKindValue(contentKind) && contentKind !== CataloguePlayableKind.Episode;
}
