import { SearchIndexerState } from "./search-indexer-state.interface";

/** Api `POST /{newsorganisation|tvshow}/index/:identifier` 200 body: the command outcome, not the read model. */
export interface CatalogueIndexResponse {
  /** TV episodes / news reports the index saved (new, merged, or removed by elimination terms). */
  indexedItemIds?: string[];
  searchIndexerState?: SearchIndexerState;
}

/** What the index dialog closes with for a news outlet / TV show. */
export interface CatalogueIndexDialogResult {
  updated?: boolean;
  itemIds?: string[];
  searchIndexerState?: SearchIndexerState;
  /** 400: removed or not auto-indexed (`NotAutoIndexed`), or its source podcast still exists. */
  notIndexable?: boolean;
  reason?: string;
  notFound?: boolean;
  /** 409: more than one outlet / show has the name. */
  ambiguous?: boolean;
  /**
   * 504 `{reason: "TimedOut"}`: the on-demand time budget cut the index off. Not a fault; what was saved
   * reaches search on the next pull-indexer run, so the curator is told to try again later.
   */
  timedOut?: boolean;
}
