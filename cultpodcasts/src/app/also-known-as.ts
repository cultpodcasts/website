/**
 * Film alternative titles for display (RedditPodcastPoster#1431): trimmed, blanks dropped,
 * joined with a middle dot. Null when the film has none.
 */
export function alsoKnownAs(titles: readonly string[] | null | undefined): string | null {
  const cleaned = (titles ?? []).map(title => title.trim()).filter(title => title.length > 0);
  return cleaned.length > 0 ? cleaned.join(" · ") : null;
}
