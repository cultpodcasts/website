/** Playable kinds on the submit-success wire (Azure / Worker OpenAPI). Not parent kinds. */
export enum CataloguePlayableKind {
  Episode = 'Episode',
  TvShowEpisode = 'TvShowEpisode',
  Film = 'Film',
  NewsReport = 'NewsReport',
}

const playableKindValues = new Set<string>(Object.values(CataloguePlayableKind));

export function isCataloguePlayableKindValue(
  contentKind: string | null | undefined
): contentKind is CataloguePlayableKind {
  return contentKind != null && playableKindValues.has(contentKind);
}
