import { CatalogueParentKind } from './catalogue-parent-kind.enum';

export interface PodcastKindTransferResponse {
  parentId?: string;
  targetKind?: CatalogueParentKind;
  playableCount?: number;
  failureIndexingPlayables?: boolean;
  /** 409 when another transfer of this podcast is still running. */
  transferInProgress?: boolean;
  /** 409 when the destination exists but the podcast row was kept — re-run to finish. */
  retryRequired?: boolean;
}
