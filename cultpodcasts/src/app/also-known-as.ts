/**
 * Film alternative titles for display (RedditPodcastPoster#1431): trimmed, blanks dropped,
 * joined with a middle dot. The first ALSO_KNOWN_AS_VISIBLE titles are shown up front;
 * the rest sit behind "+N more" until expanded. Null when the film has none.
 */
export const ALSO_KNOWN_AS_VISIBLE = 5;

export type AlsoKnownAs = {
  visible: string;
  hidden: string | null;
  hiddenCount: number;
};

export function alsoKnownAs(titles: readonly string[] | null | undefined): AlsoKnownAs | null {
  const cleaned = (titles ?? []).map(title => title.trim()).filter(title => title.length > 0);
  if (cleaned.length === 0) {
    return null;
  }
  const shown = cleaned.slice(0, ALSO_KNOWN_AS_VISIBLE);
  const rest = cleaned.slice(ALSO_KNOWN_AS_VISIBLE);
  return {
    visible: shown.join(" · "),
    hidden: rest.length > 0 ? rest.join(" · ") : null,
    hiddenCount: rest.length
  };
}
