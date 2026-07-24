/** Shape of `assets/search-suggestions.json`, generated read-only from Cosmos DB.
 * Subjects carry only their primary name + aliases (associated-subjects are
 * deliberately excluded from this corpus - see docs/search-suggestions.md). */
export interface SubjectSuggestionEntry {
  name: string;
  aliases: string[];
}

export interface SuggestionsCorpus {
  generatedAtUtc: string;
  subjects: SubjectSuggestionEntry[];
  podcasts: string[];
}

export type SuggestionType = 'subject' | 'podcast';

export interface Suggestion {
  type: SuggestionType;
  /** Canonical name used for navigation/search - never a display alias. */
  value: string;
  /** User-visible label (display-alias applied where relevant). */
  label: string;
  /** Set when the match came from a subject alias rather than its primary name. */
  matchedAlias?: string;
}
