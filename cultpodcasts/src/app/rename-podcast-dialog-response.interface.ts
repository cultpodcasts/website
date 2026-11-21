import { SearchIndexerState } from "@cultpodcasts/contracts";

export interface RenamePodcastDialogResponse {
    searchIndexerState?: SearchIndexerState;
    closed?: boolean;
    updated?: boolean;
    newPodcastName?: string;
    noChange?: boolean;
}