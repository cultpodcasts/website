import { SearchIndexerState } from "./search-indexer-state.interface";

/** Api `POST /{newsorganisation|tvshow}/index/:identifier` 200 body: the command outcome, not the read model. */
export interface CatalogueIndexResponse {
  /** TV episodes / news reports the index saved (new, merged, or removed by elimination terms). */
  indexedItemIds?: string[];
  searchIndexerState?: SearchIndexerState;
  /**
   * True when the outlet / show is not auto-indexed, so only missing Spotify / Apple links were filled in (no
   * discovery; RPP #1400). `indexedItemIds` are then the enriched items.
   */
  enrichOnly?: boolean;
}

/** What the index dialog closes with for a news outlet / TV show. */
export interface CatalogueIndexDialogResult {
  updated?: boolean;
  itemIds?: string[];
  searchIndexerState?: SearchIndexerState;
  /** 200 from an enrich-only pass: only Spotify / Apple links were filled in. */
  enrichOnly?: boolean;
  /**
   * 400 with `reason`: `Removed`, `NotAutoIndexed` (not auto-indexed, no Spotify / Apple id), `NothingToEnrich`
   * (not auto-indexed; no recent item gained a Spotify / Apple link) or `SourcePodcastStillExists` (RPP #1400).
   */
  notIndexable?: boolean;
  reason?: string;
  /** The Api's `message` for a 400, used when the reason is not one the site knows. */
  message?: string;
  notFound?: boolean;
  /** 409: more than one outlet / show has the name. */
  ambiguous?: boolean;
  /**
   * 504 `{reason: "TimedOut"}`: the on-demand time budget cut the index off. Not a fault; what was saved
   * reaches search on the next pull-indexer run, so the curator is told to try again later.
   */
  timedOut?: boolean;
}
