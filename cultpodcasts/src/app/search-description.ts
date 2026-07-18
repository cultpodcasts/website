/** Matches RedditPodcastPoster.Search.Constants.DescriptionSize */
export const SEARCH_DESCRIPTION_SIZE = 230;

/** Unicode ellipsis (U+2026) — not three ASCII periods. */
const ELLIPSIS = '\u2026';

/**
 * Softens server-truncated search descriptions for card display:
 * when the text hits the search-index length cap mid-word (no ellipsis),
 * trim back to the last word boundary and append an ellipsis.
 */
export function formatSearchDescription(description: string | null | undefined): string {
  if (!description) {
    return '';
  }

  let text = description.trimEnd();
  if (text.endsWith('...')) {
    text = `${text.slice(0, -3)}${ELLIPSIS}`;
  }
  if (text.endsWith(ELLIPSIS)) {
    return text;
  }

  // Hard-truncated search documents are exactly DescriptionSize with no ellipsis.
  if (text.length < SEARCH_DESCRIPTION_SIZE) {
    return text;
  }

  const withoutPartialWord = text.replace(/\s+\S*$/, '').trimEnd();
  if (withoutPartialWord.length === 0 || withoutPartialWord.length < text.length / 2) {
    return `${text}${ELLIPSIS}`;
  }

  return `${withoutPartialWord}${ELLIPSIS}`;
}
