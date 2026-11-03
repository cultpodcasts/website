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

/**
 * Material icon for a non-podcast playable, the same icons search suggestions use (TV `live_tv`,
 * news `newspaper`, film `movie`). Undefined for a podcast episode or an absent/unknown kind.
 */
export function contentKindIcon(kind: string | null | undefined): string | undefined {
  switch (kind) {
    case CataloguePlayableKind.TvShowEpisode:
      return "live_tv";
    case CataloguePlayableKind.NewsReport:
      return "newspaper";
    case CataloguePlayableKind.Film:
      return "movie";
    default:
      return undefined;
  }
}

/**
 * Curator overflow labels for Edit / Post on playable pages and outgoing rows.
 * Matches edit-dialog titles: Episode, Film, News Report, TV Episode.
 */
export function playableCuratorActionLabel(
  kind: string | null | undefined,
  action: "Edit" | "Post",
): string {
  switch (kind) {
    case CataloguePlayableKind.Film:
      return `${action} Film`;
    case CataloguePlayableKind.NewsReport:
      return `${action} News Report`;
    case CataloguePlayableKind.TvShowEpisode:
      return `${action} TV Episode`;
    default:
      return `${action} Episode`;
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
