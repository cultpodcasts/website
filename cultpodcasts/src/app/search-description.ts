/**
 * Card-display cap for search descriptions. The Azure index truncates
 * descriptions server-side (RedditPodcastPoster.Search.Formatting.Constants.DescriptionSize,
 * currently 80). This client cap is independent and only bounds older or
 * longer documents. Used by search-style cards and the playable detail hero,
 * not the homepage hero.
 *
 * D1 search stores the full description (SP-0.3). When `@search.engine` is
 * `"d1"`, a larger cap is used so the extra text is visible.
 */
export type SearchEngine = "azure" | "d1";

/** Azure (and missing-engine) client cap, in characters including the ellipsis. */
export const SEARCH_DESCRIPTION_SIZE = 180;

/**
 * D1 client cap, in characters including the ellipsis.
 * Production D1 on 23 Nov 2026 (84,416 non-empty descriptions): median 908,
 * p75 1,717, max 50,896. 1,000 is rounded up from the median so about half of
 * non-empty descriptions show in full, while the long tail is still clipped.
 */
export const D1_SEARCH_DESCRIPTION_SIZE = 1000;

/** Unicode ellipsis (U+2026) — not three ASCII periods. */
const ELLIPSIS = '\u2026';

/** Missing or unknown engine values keep the Azure cap, so older API deploys stay unchanged. */
export function parseSearchEngine(value: unknown): SearchEngine {
  return value === "d1" ? "d1" : "azure";
}

export function searchDescriptionSize(engine?: SearchEngine | null): number {
  return engine === "d1" ? D1_SEARCH_DESCRIPTION_SIZE : SEARCH_DESCRIPTION_SIZE;
}

/**
 * Softens server-truncated search descriptions for card display:
 * when the text hits the search-index length cap mid-word (no ellipsis),
 * trim back to the last word boundary and append an ellipsis.
 */
export function formatSearchDescription(
  description: string | null | undefined,
  engine?: SearchEngine | null
): string {
  if (!description) {
    return '';
  }

  const max = searchDescriptionSize(engine);
  let text = description.trimEnd();
  if (text.endsWith('...')) {
    text = `${text.slice(0, -3)}${ELLIPSIS}`;
  }
  if (text.endsWith(ELLIPSIS) && text.length <= max) {
    return text;
  }

  if (text.length > max) {
    text = text.slice(0, max);
  }

  if (text.endsWith(ELLIPSIS)) {
    return text;
  }

  // Hard-truncated search documents are exactly the cap with no ellipsis.
  if (text.length < max) {
    return text;
  }

  const withoutPartialWord = text.replace(/\s+\S*$/, '').trimEnd();
  if (withoutPartialWord.length === 0 || withoutPartialWord.length < text.length / 2) {
    return `${text}${ELLIPSIS}`;
  }

  return `${withoutPartialWord}${ELLIPSIS}`;
}
