export interface HeroCuration {
  episodeIds: string[];
  /** Ordered subjects a curator pinned as homepage rails. */
  railSubjects: string[];
  updatedAt: string | null;
}
