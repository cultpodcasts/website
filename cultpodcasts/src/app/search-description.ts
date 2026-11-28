import { SearchEngine } from './search-engine.enum';

/**
 * Card-display cap for search descriptions. The Azure index truncates
 * descriptions server-side (RedditPodcastPoster.Search.Formatting.Constants.DescriptionSize,
 * currently 80). This client cap is independent and only bounds older or
 * longer documents. Used by search-style cards and the playable detail hero,
 * not the homepage hero.
 *
 * D1 search stores the full description (SP-0.3). When `@search.engine` is
 * `"d1"`, the description is passed through in full (trimmed, no character
 * cap), like the homepage hero's featured description; the playable detail
 * hero shows it in `app-hero-description` with the homepage line clamp
 * (5 / 4 / 3 lines) and an expander to the full text (#703). Azure and a
 * missing engine keep the 180-character formatter (index cap 80) and are not
 * clamped.
 */
/** Azure (and missing-engine) client cap, in characters including the ellipsis. */
export const SEARCH_DESCRIPTION_SIZE = 180;

/** Unicode ellipsis (U+2026) — not three ASCII periods. */
const ELLIPSIS = '\u2026';

/** Missing or unknown engine values keep the Azure cap, so older API deploys stay unchanged. */
export function parseSearchEngine(value: unknown): SearchEngine {
  return value === SearchEngine.D1 ? SearchEngine.D1 : SearchEngine.Azure;
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

  // D1: the full description, uncapped (the homepage hero does not limit descriptions either).
  if (engine === SearchEngine.D1) {
    return description.trim();
  }

  const max = SEARCH_DESCRIPTION_SIZE;
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
