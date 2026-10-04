import { CataloguePlayableKind } from "./catalogue-playable-kind.enum";

export function contentKindLabel(kind: string): string {
  switch (kind) {
    case CataloguePlayableKind.Episode:
      return "Podcast";
    case CataloguePlayableKind.TvShowEpisode:
      return "TV";
    case CataloguePlayableKind.NewsReport:
      return "News";
    case CataloguePlayableKind.Film:
      return "Film";
    default:
      return kind;
  }
}

/** Catalogue snackbar verb after POST /submit. Unknown outcomes stay “saved”. */
export function catalogueSubmitOutcomePhrase(episode: string | undefined): string {
  switch (episode) {
    case "Created":
      return "created";
    case "EpisodeAlreadyExists":
      return "already exists";
    case "Enriched":
      return "enriched";
    case "Ignored":
      return "ignored";
    default:
      return "saved";
  }
}
