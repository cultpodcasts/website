export interface DiscoverySessionVote {
  userId: string;
  role: string;
  at: Date;
}

/**
 * HTTP responses go through `JsonDateInterceptor` and WebSocket frames through `convertJsonDates`; both turn every
 * ISO date-time-shaped string at any depth into a `Date`. Any free-text field added here later (for example a vote
 * comment) must go in the keep-as-text set: `KEEP_AS_TEXT_KEYS` on the session HTTP requests and the second argument
 * to `convertJsonDates` in `DiscoveryCurationSessionService`.
 */
export interface DiscoveryCurationSessionSnapshot {
  includedDocumentIds: string[];
  pendingDocumentIds: string[];
  selectedResultIds: string[];
  votesByResultId: Record<
    string,
    { votes: DiscoverySessionVote[]; rev: number; provisional: boolean }
  >;
  /** userId → last seen. */
  presence: Record<string, Date>;
  rev: number;
  updatedAt: Date;
}
