import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  Suggestion,
  SuggestionIndexEntry,
  SuggestionsCorpus
} from './search-suggestions.interface';
import { displayCatalogName } from './display-catalog-name';

const SUGGESTIONS_ASSET_PATH = 'assets/search-suggestions.json';
const DEFAULT_LIMIT = 8;

/**
 * Loads the flat, pre-normalized typeahead index (see docs/search-suggestions.md)
 * and ranks matches for a query. Loaded lazily and cached for the app lifetime.
 */
@Injectable({ providedIn: 'root' })
export class SearchSuggestionsService {
  private http = inject(HttpClient);
  private corpusPromise: Promise<SuggestionIndexEntry[]> | undefined;

  private loadIndex(): Promise<SuggestionIndexEntry[]> {
    if (!this.corpusPromise) {
      this.corpusPromise = firstValueFrom(
        this.http.get<SuggestionsCorpus>(SUGGESTIONS_ASSET_PATH)
      )
        .then(corpus => Array.isArray(corpus?.entries) ? corpus.entries : [])
        .catch(e => {
          console.error('Failed to load search suggestions corpus.', e);
          this.corpusPromise = undefined;
          return [] as SuggestionIndexEntry[];
        });
    }
    return this.corpusPromise;
  }

  /** Pre-warms the corpus cache (e.g. on first focus) without waiting on a query. */
  preload(): void {
    void this.loadIndex();
  }

  async suggest(query: string, limit: number = DEFAULT_LIMIT): Promise<Suggestion[]> {
    const term = query.trim().toLowerCase();
    if (term.length === 0) {
      return [];
    }

    const index = await this.loadIndex();
    // Best rank per type+canonical (alias rows and name rows for the same subject
    // must collapse to one suggestion).
    const best = new Map<string, { suggestion: Suggestion; rank: number }>();

    for (const entry of index) {
      const rank = rankMatch(entry.searchText, term, !!entry.alias);
      if (rank < 0) {
        continue;
      }
      const key = `${entry.type}:${entry.canonical}`;
      const suggestion = toSuggestion(entry);
      const existing = best.get(key);
      if (!existing || rank < existing.rank ||
        (rank === existing.rank && suggestion.label.length < existing.suggestion.label.length)) {
        best.set(key, { suggestion, rank });
      }
    }

    return [...best.values()]
      .sort((a, b) => a.rank - b.rank || a.suggestion.label.length - b.suggestion.label.length)
      .slice(0, limit)
      .map(r => r.suggestion);
  }
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

function toSuggestion(entry: SuggestionIndexEntry): Suggestion {
  return {
    type: entry.type,
    value: entry.canonical,
    label: displayCatalogName(entry.canonical),
    matchedAlias: entry.alias
  };
}
