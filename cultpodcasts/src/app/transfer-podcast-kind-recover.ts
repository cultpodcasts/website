import { HttpErrorResponse } from '@angular/common/http';
import { CatalogueParentKind } from './catalogue-parent-kind.enum';
import {
  PodcastKindTransferJobStatus,
  PodcastKindTransferJobStatusResponse,
  PodcastKindTransferResponse
} from './podcast-kind-transfer-response.interface';
import { youtubePlaylistEditError } from './youtube-playlist-edit-error';

/** Total wait while polling an in-progress transfer (~2 minutes). */
export const TRANSFER_KIND_POLL_BUDGET_MS = 120_000;

/** Idle re-reads tolerated after a 409 / transport failure (read-after-write lag only). */
export const IDLE_GRACE_READS_RECOVERY = 1;

/** Idle re-reads tolerated after an accepted 202 (the job was saved before the response). */
export const IDLE_GRACE_READS_ACCEPTED = 3;

const POLL_CAP_MS = 30_000;
const POLL_START_MS = 2_000;

/** Backoff delays that sum to about {@link TRANSFER_KIND_POLL_BUDGET_MS}. */
export function transferKindPollDelaysMs(
  budgetMs: number = TRANSFER_KIND_POLL_BUDGET_MS
): number[] {
  const delays: number[] = [];
  let total = 0;
  let next = POLL_START_MS;
  while (total < budgetMs) {
    const remaining = budgetMs - total;
    const delay = Math.min(next, remaining, POLL_CAP_MS);
    delays.push(delay);
    total += delay;
    next = Math.min(next * 2, POLL_CAP_MS);
  }
  return delays;
}

/**
 * Network drop, client timeout, Cloudflare 499, or upstream 5xx / gateway timeout.
 * Playlist ownership ApiErrors (400/503 with playlist codes, including retryable lookup-failed)
 * are not transport recoveries — the transfer never wrote; do not poll for completion.
 */
export function isRecoverableTransferTransportError(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) {
    return false;
  }
  if (youtubePlaylistEditError(error)) {
    return false;
  }
  return error.status === 0
    || error.status === 408
    || error.status === 499
    || error.status >= 500;
}

export function transferInProgressFromError(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse) || error.status !== 409) {
    return false;
  }
  const body = error.error as PodcastKindTransferResponse | null | undefined;
  return body?.transferInProgress === true || body?.status === 'AlreadyRunning';
}

export function isConflictStatus(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 409;
}

export function isJobCompleted(status: PodcastKindTransferJobStatus): boolean {
  return status === 'Completed';
}

export function isJobFailed(status: PodcastKindTransferJobStatus): boolean {
  return status === 'Failed' || status === 'Incomplete';
}

/** Completed, Failed or Incomplete: polling has nothing more to learn. */
export function isJobTerminal(status: PodcastKindTransferJobStatus): boolean {
  return isJobCompleted(status) || isJobFailed(status);
}

/**
 * Close-dialog body when GET status says Completed. A job without a parent id or kind
 * falls back to the podcast id (the parent keeps the podcast's id) and the requested kind.
 */
export function enqueueShapeFromJob(
  job: PodcastKindTransferJobStatusResponse,
  podcastId: string,
  targetKind: CatalogueParentKind
): PodcastKindTransferResponse {
  return {
    parentId: job.parentId ?? podcastId,
    targetKind: job.targetKind ?? targetKind,
    playableCount: job.playableCount,
    failureIndexingPlayables: job.failureIndexingPlayables
  };
}

/** Transfer succeeded when the target parent exists and the podcast row is gone. */
export function isTransferComplete(parentExists: boolean, podcastGone: boolean): boolean {
  return parentExists && podcastGone;
}

export function delayMs(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 401/403 on the status GET will not improve by polling (missing curate scope, expired token). */
export function isJobReadDenied(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);
}

/** One GET /podcast/:id/kind attempt. */
export type KindTransferJobRead =
  | { kind: 'job'; job: PodcastKindTransferJobStatusResponse }
  /** 404, 5xx, transport: status unknown, may succeed on a later read. */
  | { kind: 'unavailable' }
  /** 401/403: stop polling and surface the error. */
  | { kind: 'denied'; error: unknown };

/**
 * What the poll learned.
 * - `terminal`: Completed / Failed / Incomplete.
 * - `pending`: the last read was Queued / Running and the budget ran out.
 * - `idle`: no job is recorded (after the allowed grace re-reads).
 * - `unavailable`: the last read could not determine status.
 * - `denied`: the status GET is not permitted.
 */
export type KindTransferPollResult =
  | { kind: 'terminal'; job: PodcastKindTransferJobStatusResponse }
  | { kind: 'pending'; job: PodcastKindTransferJobStatusResponse }
  | { kind: 'idle' }
  | { kind: 'unavailable' }
  | { kind: 'denied'; error: unknown };

export interface KindTransferPollOptions {
  /** Consecutive Idle reads tolerated before concluding that no job exists. */
  idleGraceReads: number;
  /** Waits between reads; defaults to {@link transferKindPollDelaysMs}. */
  delaysMs?: readonly number[];
  /** Injectable wait for tests. */
  wait?: (ms: number) => Promise<void>;
}

/** Reads status immediately, then after each backoff delay, until terminal / denied / exhausted. */
export async function pollKindTransferJob(
  read: () => Promise<KindTransferJobRead>,
  options: KindTransferPollOptions
): Promise<KindTransferPollResult> {
  const wait = options.wait ?? delayMs;
  const delays = [0, ...(options.delaysMs ?? transferKindPollDelaysMs())];
  let idleReads = 0;
  let last: KindTransferPollResult = { kind: 'unavailable' };

  for (const waitMs of delays) {
    if (waitMs > 0) {
      await wait(waitMs);
    }
    const result = await read();
    if (result.kind === 'denied') {
      return result;
    }
    if (result.kind === 'unavailable') {
      last = result;
      continue;
    }
    const { job } = result;
    if (isJobTerminal(job.status)) {
      return { kind: 'terminal', job };
    }
    if (job.status === 'Idle') {
      idleReads++;
      last = { kind: 'idle' };
      if (idleReads > options.idleGraceReads) {
        return last;
      }
      continue;
    }
    idleReads = 0;
    last = { kind: 'pending', job };
  }
  return last;
}
