import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Suggestion, SuggestionsCorpus } from './search-suggestions.interface';
import { displayCatalogName } from './display-catalog-name';

const SUGGESTIONS_ASSET_PATH = 'assets/search-suggestions.json';
const DEFAULT_LIMIT = 8;

/**
 * Loads the read-only, Cosmos-sourced typeahead corpus (subjects + aliases,
 * podcast names - see docs/search-suggestions.md) and ranks matches for a
 * given query. Loaded lazily and cached for the lifetime of the app.
 */
@Injectable({ providedIn: 'root' })
export class SearchSuggestionsService {
  private http = inject(HttpClient);
  private corpusPromise: Promise<SuggestionsCorpus> | undefined;

  private loadCorpus(): Promise<SuggestionsCorpus> {
    if (!this.corpusPromise) {
      this.corpusPromise = firstValueFrom(
        this.http.get<SuggestionsCorpus>(SUGGESTIONS_ASSET_PATH)
      ).catch(e => {
        console.error('Failed to load search suggestions corpus.', e);
        this.corpusPromise = undefined;
        return { generatedAtUtc: '', subjects: [], podcasts: [] } as SuggestionsCorpus;
      });
    }
    return this.corpusPromise;
  }

  /** Pre-warms the corpus cache (e.g. on first focus) without waiting on a query. */
  preload(): void {
    void this.loadCorpus();
  }

  async suggest(query: string, limit: number = DEFAULT_LIMIT): Promise<Suggestion[]> {
    const term = query.trim().toLowerCase();
    if (term.length === 0) {
      return [];
    }

    const corpus = await this.loadCorpus();
    const results: { suggestion: Suggestion; rank: number }[] = [];

    for (const subject of corpus.subjects) {
      const nameLower = subject.name.toLowerCase();
      if (nameLower === term) {
        results.push({ suggestion: this.toSubjectSuggestion(subject.name), rank: 0 });
        continue;
      }
      if (nameLower.startsWith(term)) {
        results.push({ suggestion: this.toSubjectSuggestion(subject.name), rank: 1 });
        continue;
      }

      const aliasMatch = subject.aliases.find(a => a.toLowerCase() === term);
      if (aliasMatch) {
        results.push({ suggestion: this.toSubjectSuggestion(subject.name, aliasMatch), rank: 2 });
        continue;
      }
      const aliasStartsWith = subject.aliases.find(a => a.toLowerCase().startsWith(term));
      if (aliasStartsWith) {
        results.push({ suggestion: this.toSubjectSuggestion(subject.name, aliasStartsWith), rank: 3 });
        continue;
      }

      if (nameLower.includes(term)) {
        results.push({ suggestion: this.toSubjectSuggestion(subject.name), rank: 4 });
        continue;
      }
      const aliasContains = subject.aliases.find(a => a.toLowerCase().includes(term));
      if (aliasContains) {
        results.push({ suggestion: this.toSubjectSuggestion(subject.name, aliasContains), rank: 5 });
      }
    }

    for (const podcastName of corpus.podcasts) {
      const nameLower = podcastName.toLowerCase();
      if (nameLower === term) {
        results.push({ suggestion: this.toPodcastSuggestion(podcastName), rank: 0 });
      } else if (nameLower.startsWith(term)) {
        results.push({ suggestion: this.toPodcastSuggestion(podcastName), rank: 1 });
      } else if (nameLower.includes(term)) {
        results.push({ suggestion: this.toPodcastSuggestion(podcastName), rank: 4 });
      }
    }

    return results
      .sort((a, b) => a.rank - b.rank || a.suggestion.label.length - b.suggestion.label.length)
      .slice(0, limit)
      .map(r => r.suggestion);
  }

  private toSubjectSuggestion(name: string, matchedAlias?: string): Suggestion {
    return {
      type: 'subject',
      value: name,
      label: displayCatalogName(name),
      matchedAlias
    };
  }

  private toPodcastSuggestion(name: string): Suggestion {
    return {
      type: 'podcast',
      value: name,
      label: displayCatalogName(name)
    };
  }
}
