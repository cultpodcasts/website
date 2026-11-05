import { HttpErrorResponse } from '@angular/common/http';
import { PodcastKindTransferResponse } from './podcast-kind-transfer-response.interface';
import { youtubePlaylistEditError } from './youtube-playlist-edit-error';

/** Total wait while polling an in-progress transfer (~2 minutes). */
export const TRANSFER_KIND_POLL_BUDGET_MS = 120_000;

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
  if (isRetryableApiRefuseBody(error)) {
    return false;
  }
  return error.status === 0
    || error.status === 408
    || error.status === 499
    || error.status >= 500;
}

/** Intentional Api refuse with retryable:true (e.g. 503) — not a mid-write transport drop. */
function isRetryableApiRefuseBody(error: HttpErrorResponse): boolean {
  if (error.status < 500) {
    return false;
  }
  const raw = error.error;
  if (!raw || typeof raw !== 'object') {
    return false;
  }
  const body = raw as Record<string, unknown>;
  return body['retryable'] === true;
}

export function transferInProgressFromError(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse) || error.status !== 409) {
    return false;
  }
  const body = error.error as PodcastKindTransferResponse | null | undefined;
  return body?.transferInProgress === true;
}

export function isConflictStatus(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 409;
}

/** Transfer succeeded when the target parent exists and the podcast row is gone. */
export function isTransferComplete(parentExists: boolean, podcastGone: boolean): boolean {
  return parentExists && podcastGone;
}

export function delayMs(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
