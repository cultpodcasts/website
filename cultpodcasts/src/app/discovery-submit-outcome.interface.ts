import { DiscoverySubmitOutcomeState } from './discovery-submit-outcome-state.enum';

/** One durable stamp from POST /discovery-curation/submit-outcome. */
export interface DiscoverySubmitOutcomeItem {
  discoveryItemId: string;
  state: DiscoverySubmitOutcomeState;
  podcastId?: string | null;
  episodeId?: string | null;
  message?: string | null;
  episodeName?: string | null;
  showName?: string | null;
}

export interface DiscoverySubmitOutcomeResponse {
  results: DiscoverySubmitOutcomeItem[];
}

export { DiscoverySubmitOutcomeState };
