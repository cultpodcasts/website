import { CatalogueParentKind } from './catalogue-parent-kind.enum';

/** POST /podcast/:id/kind — enqueue outcome (RPP #1162). */
export type PodcastKindTransferEnqueueStatus = 'Queued' | 'AlreadyRunning';

/** GET /podcast/:id/kind — job status (RPP #1162). */
export type PodcastKindTransferJobStatus =
  | 'Idle'
  | 'Queued'
  | 'Running'
  | 'Completed'
  | 'Failed'
  | 'Incomplete';

export interface PodcastKindTransferResponse {
  status?: PodcastKindTransferEnqueueStatus;
  parentId?: string;
  targetKind?: CatalogueParentKind;
  enqueuedUtc?: string;
  statusPath?: string;
  /** Legacy 409 body when another transfer is still running. Prefer status AlreadyRunning. */
  transferInProgress?: boolean;
  /** Legacy 409 body when the destination exists but the podcast row was kept. */
  retryRequired?: boolean;
  playableCount?: number;
  failureIndexingPlayables?: boolean;
}

export interface PodcastKindTransferJobStatusResponse {
  status: PodcastKindTransferJobStatus;
  parentId?: string | null;
  targetKind?: CatalogueParentKind | null;
  playableCount?: number;
  failureIndexingPlayables?: boolean;
  failureReason?: string | null;
  enqueuedUtc?: string | null;
  startedUtc?: string | null;
  completedUtc?: string | null;
}
