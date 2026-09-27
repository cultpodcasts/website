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
