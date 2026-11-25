import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  Suggestion,
  SuggestionIndexEntry,
  SuggestionType,
  SuggestionsCorpus
} from './search-suggestions.interface';
import { displayCatalogName } from './display-catalog-name';
import { environment } from './../environments/environment';

const DEFAULT_LIMIT = 8;

/** `suggest` options. The search bar omits these and keeps an empty list when the corpus fails to load. */
export interface SuggestOptions {
  /**
   * Keep every row whose name equals the query, past `limit`.
   * Other matches stay capped at `limit` (move-to-film: eleven films can share one name).
   */
  allExactNames?: boolean;
}

/**
 * Loads the flat, pre-normalized typeahead index from GET /search-suggestions
 * (R2 via the API worker; see docs/search-suggestions.md) and ranks matches.
 * Loaded lazily and cached for the app lifetime.
 */
@Injectable({ providedIn: 'root' })
export class SearchSuggestionsService {
  private http = inject(HttpClient);
  private corpusPromise: Promise<SuggestionIndexEntry[]> | undefined;
  /** Set when the last corpus load failed. Cleared on the next successful load. */
  private loadFailed = false;

  /**
   * True when the suggestions corpus failed to load.
   * `suggest` still returns `[]` so the search bar's typeahead stays an empty list.
   */
  corpusLoadFailed(): boolean {
    return this.loadFailed;
  }

  private loadIndex(): Promise<SuggestionIndexEntry[]> {
    if (!this.corpusPromise) {
      const url = new URL('/search-suggestions', environment.api).toString();
      this.corpusPromise = firstValueFrom(
        this.http.get<SuggestionsCorpus>(url)
      )
        .then(corpus => {
          this.loadFailed = false;
          return Array.isArray(corpus?.entries) ? corpus.entries : [];
        })
        .catch(e => {
          console.error('Failed to load search suggestions corpus.', e);
          this.corpusPromise = undefined;
          this.loadFailed = true;
          return [] as SuggestionIndexEntry[];
        });
    }
    return this.corpusPromise;
  }

  /** Pre-warms the corpus cache (e.g. on first focus) without waiting on a query. */
  preload(): void {
    void this.loadIndex();
  }

  async suggest(
    query: string,
    limit: number = DEFAULT_LIMIT,
    type?: SuggestionType,
    options?: SuggestOptions
  ): Promise<Suggestion[]> {
    const term = query.trim().toLowerCase();
    if (term.length === 0) {
      return [];
    }

    const index = await this.loadIndex();
    // Best rank per type+canonical (alias rows and name rows for the same subject
    // must collapse to one suggestion). Rows with an id (films) key on the id so
    // two films with the same name stay separate.
    const best = new Map<string, { suggestion: Suggestion; rank: number }>();

    for (const entry of index) {
      if (type && entry.type !== type) {
        continue;
      }
      const rank = rankMatch(entry.searchText, term, !!entry.alias);
      if (rank < 0) {
        continue;
      }
      const key = suggestionKey(entry);
      const suggestion = toSuggestion(entry);
      const existing = best.get(key);
      if (!existing || rank < existing.rank ||
        (rank === existing.rank && suggestion.label.length < existing.suggestion.label.length)) {
        best.set(key, { suggestion, rank });
      }
    }

    const ranked = [...best.values()]
      .sort((a, b) => a.rank - b.rank || a.suggestion.label.length - b.suggestion.label.length);
    const picked = options?.allExactNames
      ? [
          ...ranked.filter(row => isExactName(row.suggestion, term)),
          ...ranked.filter(row => !isExactName(row.suggestion, term)).slice(0, limit)
        ]
      : ranked.slice(0, limit);
    return picked.map(r => r.suggestion);
  }
}

function isExactName(suggestion: Suggestion, term: string): boolean {
  return suggestion.label.trim().toLowerCase() === term
    || suggestion.value.trim().toLowerCase() === term;
}

/** exact=0/2, prefix=1/3, contains=4/5; alias rows use the higher band. -1 = no match. */
function rankMatch(searchText: string, term: string, isAlias: boolean): number {
  if (searchText === term) {
    return isAlias ? 2 : 0;
  }
  if (searchText.startsWith(term)) {
    return isAlias ? 3 : 1;
  }
  if (searchText.includes(term)) {
    return isAlias ? 5 : 4;
  }
  return -1;
}

/** Dedupe key: type+id when the row has an id (films), else type+canonical. */
export function suggestionKey(entry: Pick<SuggestionIndexEntry, 'type' | 'canonical' | 'id'>): string {
  return entry.id ? `${entry.type}#${entry.id}` : `${entry.type}:${entry.canonical}`;
}

function toSuggestion(entry: SuggestionIndexEntry): Suggestion {
  const suggestion: Suggestion = {
    type: entry.type,
    value: entry.canonical,
    label: displayCatalogName(entry.canonical),
    matchedAlias: entry.alias
  };
  if (entry.id) {
    suggestion.itemId = entry.id;
  }
  return suggestion;
}
