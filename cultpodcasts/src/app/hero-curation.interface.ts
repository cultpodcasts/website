export interface HeroCuration {
  episodeIds: string[];
  /**
   * Ordered homepage rails: pinned subject names mixed with relative day slots
   * (`day:0` = newest / n, `day:1` = n−1, …).
   */
  railSubjects: string[];
  updatedAt: string | null;
}
