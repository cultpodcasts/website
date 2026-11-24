import { SearchEngine } from './search-engine.enum';

/**
 * Card-display cap for search descriptions. The Azure index truncates
 * descriptions server-side (RedditPodcastPoster.Search.Formatting.Constants.DescriptionSize,
 * currently 80). This client cap is independent and only bounds older or
 * longer documents. Used by search-style cards and the playable detail hero,
 * not the homepage hero.
 *
 * D1 search stores the full description (SP-0.3). When `@search.engine` is
 * `"d1"`, the playable detail hero shows it in `app-hero-description`: the
 * homepage hero's line clamp (5 / 4 / 3 lines) with an expander to the full
 * text (#703). A generous character cap still runs first as a safety net so a
 * 50k-character tail is not put in the DOM. Azure and a missing engine keep the existing
 * 180-character formatter (index cap 80) and do not get the clamp CSS.
 */
/** Azure (and missing-engine) client cap, in characters including the ellipsis. */
export const SEARCH_DESCRIPTION_SIZE = 180;

/**
 * D1 character safety net, in characters including the ellipsis. Collapsed, the
 * visible cap is the line clamp in `app-hero-description`; expanded shows up to
 * this many characters (#703), so it covers most descriptions in full.
 * Production D1 on 23 Nov 2026 (84,416 non-empty descriptions): median 908,
 * p75 1,717, max 50,896. 5,000 shows well past the p75 in full while still
 * clipping the long tail before it reaches the DOM.
 */
export const D1_SEARCH_DESCRIPTION_SIZE = 5000;

/** Unicode ellipsis (U+2026) — not three ASCII periods. */
const ELLIPSIS = '\u2026';

/** Missing or unknown engine values keep the Azure cap, so older API deploys stay unchanged. */
export function parseSearchEngine(value: unknown): SearchEngine {
  return value === SearchEngine.D1 ? SearchEngine.D1 : SearchEngine.Azure;
}

export function searchDescriptionSize(engine?: SearchEngine | null): number {
  return engine === SearchEngine.D1 ? D1_SEARCH_DESCRIPTION_SIZE : SEARCH_DESCRIPTION_SIZE;
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
