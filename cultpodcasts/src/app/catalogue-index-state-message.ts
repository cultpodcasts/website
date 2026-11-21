import { SearchIndexerState } from "./search-indexer-state.interface";

/** Snackbar wording for the indexState returned by a rename. */
export function indexStateMessage(state: SearchIndexerState | undefined): string {
  switch (state) {
    case 'Executed':
      return "Index updated.";
    case 'Failure':
      return "Index update failed.";
    case 'TooManyRequests':
      return "Index not updated (too many requests).";
    case 'AlreadyRunning':
      return "Index not updated (indexer already running).";
    case 'NoDocuments':
      return "Index not updated (no documents to index).";
    case undefined:
      return "Index state unknown.";
    default:
      return "Index not updated.";
  }
}
