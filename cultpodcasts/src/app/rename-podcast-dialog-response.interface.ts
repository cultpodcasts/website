import { SearchIndexerState } from "./search-indexer-state.interface";

export interface RenamePodcastDialogResponse {
    searchIndexerState?: SearchIndexerState;
    closed?: boolean;
    updated?: boolean;
    newPodcastName?: string;
    noChange?: boolean;
}