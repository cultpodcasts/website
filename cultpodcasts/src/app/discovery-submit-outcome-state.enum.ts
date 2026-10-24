/** Wire states for POST /discovery-curation/submit-outcome (matches Azure DiscoverySubmitOutcomeState). */
export enum DiscoverySubmitOutcomeState {
  Accepted = 'Accepted',
  AcceptError = 'AcceptError',
  Rejected = 'Rejected',
  Pending = 'Pending',
  Unknown = 'Unknown'
}
