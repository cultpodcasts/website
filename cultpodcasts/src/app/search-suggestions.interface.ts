/** Flat match-index shape of `assets/search-suggestions.json`.
 * One row per searchable string (subject name, each subject alias, each podcast,
 * TV show, news organisation and film name).
 * Associated-subjects are deliberately excluded — see docs/search-suggestions.md. */

export type SuggestionType = 'subject' | 'podcast' | 'tvShow' | 'newsOrganisation' | 'film';

/** One pre-normalized row in the on-disk / in-memory match index. */
export interface SuggestionIndexEntry {
  type: SuggestionType;
  /** Canonical name used for navigation/search — never a display alias. */
  canonical: string;
  /** Lowercased text matched against the query (name or alias). */
  searchText: string;
  /** Present when this row indexes a subject alias (original casing for UI). */
  alias?: string;
  /** Item id (guid). Films carry it because film names can repeat; omitted otherwise. */
  id?: string;
}

export interface SuggestionsCorpus {
  generatedAtUtc: string;
  entries: SuggestionIndexEntry[];
}

export interface Suggestion {
  type: SuggestionType;
  /** Canonical name used for navigation/search - never a display alias. */
  value: string;
  /** User-visible label (display-alias applied where relevant). */
  label: string;
  /** Set when the match came from a subject alias rather than its primary name. */
  matchedAlias?: string;
  /** Item id from the index row (films). Not named `id`: the submit dialog tells a
   * SimplePodcast ({ id, name }) from a Suggestion by `'id' in value`. */
  itemId?: string;
}
