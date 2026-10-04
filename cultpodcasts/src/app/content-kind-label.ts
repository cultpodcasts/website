export function contentKindLabel(kind: string): string {
  switch (kind) {
    case "Episode":
      return "Podcast";
    case "TvShowEpisode":
      return "TV";
    case "NewsReport":
      return "News";
    case "Film":
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
