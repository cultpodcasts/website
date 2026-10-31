export interface DiscoverySessionVote {
  userId: string;
  role: string;
  at: Date;
}

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
