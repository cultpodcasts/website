export interface DiscoverySessionVote {
  userId: string;
  role: string;
  at: string;
}

export interface DiscoveryCurationSessionSnapshot {
  includedDocumentIds: string[];
  pendingDocumentIds: string[];
  selectedResultIds: string[];
  votesByResultId: Record<
    string,
    { votes: DiscoverySessionVote[]; rev: number; provisional: boolean }
  >;
  presence: Record<string, string>;
  rev: number;
  updatedAt: string;
}
