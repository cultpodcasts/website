import { HttpErrorResponse } from '@angular/common/http';
import {
  DiscoverySubmissionDetail,
  DiscoverySubmissionItemComment,
  DiscoverySubmissionItemOutcome,
  DiscoverySubmissionStatus
} from './discovery-supervision.models';

/** UI role (ID token) for users who review supervised discovery submissions. */
export const SUPERVISOR_ROLE = 'Supervisor';
/** UI role (ID token) for curators whose discovery submits are held for review. */
export const SUPERVISED_CURATOR_ROLE = 'SupervisedCurator';
export const ADMIN_ROLE = 'Admin';

/** Access-token scopes for the discovery-submissions read routes (Worker accepts any one). */
export const DISCOVERY_SUBMISSIONS_SCOPE = 'curate:supervised supervise admin';
/** Access-token scopes for supervisor commands (review / apply / retry / release). */
export const DISCOVERY_SUPERVISE_SCOPE = 'supervise admin';
/**
 * Discovery submit: request `curate:supervised` alongside `curate` so a supervised
 * user's token always carries it (scope-claim checks), and their submit is held.
 */
export const DISCOVERY_SUBMIT_SCOPE = 'curate curate:supervised';

export function isSupervisorRole(roles: readonly string[]): boolean {
  return roles.includes(SUPERVISOR_ROLE) || roles.includes(ADMIN_ROLE);
}

export function canSeeSubmissions(roles: readonly string[]): boolean {
  return isSupervisorRole(roles) || roles.includes(SUPERVISED_CURATOR_ROLE);
}

const statusLabels: Record<DiscoverySubmissionStatus, string> = {
  Pending: 'Awaiting review',
  Applying: 'In progress',
  Applied: 'Applied',
  PartiallyApplied: 'Partially applied',
  ApplyFailed: 'Apply failed',
  Released: 'Released'
};

export function submissionStatusLabel(status: DiscoverySubmissionStatus): string {
  return statusLabels[status] ?? status;
}

/** How a result relates to the submitter's (AI's) picks and the final set. */
export type PickState = 'kept' | 'added' | 'removed' | 'none';

export function pickState(resultId: string, submitterIds: readonly string[], finalIds: readonly string[]): PickState {
  const ai = submitterIds.includes(resultId);
  const fin = finalIds.includes(resultId);
  if (ai && fin) return 'kept';
  if (fin) return 'added';
  if (ai) return 'removed';
  return 'none';
}

export const pickStateLabels: Record<PickState, string> = {
  kept: 'Submitter picked · kept',
  added: 'Added by supervisor',
  removed: 'Submitter picked · removed by supervisor',
  none: 'Not picked'
};

export function pickDiff(submitterIds: readonly string[], finalIds: readonly string[]): { added: string[]; removed: string[] } {
  return {
    added: finalIds.filter(id => !submitterIds.includes(id)),
    removed: submitterIds.filter(id => !finalIds.includes(id))
  };
}

/** The supervisor's working set: saved review set, else the submitter's picks. */
export function initialFinalIds(detail: DiscoverySubmissionDetail): string[] {
  return [...(detail.supervisorAcceptedResultIds ?? detail.submitterAcceptedResultIds)];
}

export function commentsToMap(comments: readonly DiscoverySubmissionItemComment[] | null | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of comments ?? []) {
    map[c.resultId] = c.comment;
  }
  return map;
}

/** Non-blank item comments, trimmed, in stable order. */
export function mapToComments(map: Readonly<Record<string, string>>): DiscoverySubmissionItemComment[] {
  return Object.entries(map)
    .map(([resultId, comment]) => ({ resultId, comment: comment.trim() }))
    .filter(c => c.comment.length > 0);
}

export function outcomeFor(
  outcomes: readonly DiscoverySubmissionItemOutcome[] | null | undefined,
  resultId: string
): DiscoverySubmissionItemOutcome | undefined {
  return outcomes?.find(o => o.resultId === resultId);
}

export function failedOutcomes(outcomes: readonly DiscoverySubmissionItemOutcome[] | null | undefined): DiscoverySubmissionItemOutcome[] {
  return (outcomes ?? []).filter(o => o.state === 'Failed');
}

/** Supervisor may edit the review / apply only while Pending. */
export function canEditReview(detail: DiscoverySubmissionDetail): boolean {
  return detail.canReview && detail.status === 'Pending';
}

/** Retry / abandon applies to submissions with failed items. */
export function canRetry(detail: DiscoverySubmissionDetail): boolean {
  return detail.canReview
    && (detail.status === 'PartiallyApplied' || detail.status === 'ApplyFailed')
    && failedOutcomes(detail.itemOutcomes).length > 0;
}

/** Release (unlock reports, ingest nothing) is only possible before anything was ingested. */
export function canRelease(detail: DiscoverySubmissionDetail): boolean {
  const anySucceeded = (detail.itemOutcomes ?? []).some(o => o.state === 'Succeeded');
  return detail.canReview
    && (detail.status === 'Pending' || detail.status === 'ApplyFailed')
    && !anySucceeded;
}

/** An Applying submission older than this may be recovered by an admin. */
export const RECOVER_AFTER_MS = 30 * 60 * 1000;

/** Admin-only: recover a submission stuck in Applying for over 30 minutes. */
export function canRecover(detail: DiscoverySubmissionDetail, isAdmin: boolean, now: Date = new Date()): boolean {
  if (!isAdmin || detail.status !== 'Applying' || !detail.inProgressSince) return false;
  const since = new Date(detail.inProgressSince).getTime();
  return !Number.isNaN(since) && now.getTime() - since > RECOVER_AFTER_MS;
}

export function inProgressLabel(op: string | null | undefined): string {
  switch (op) {
    case 'Apply': return 'Applying';
    case 'Retry': return 'Retrying failed items';
    case 'Release': return 'Releasing';
  }
  return 'In progress';
}

/** Human message for a failed discovery / submission HTTP call. */
export function describeSubmissionError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { message?: string; resultIds?: string[] | null; documentIds?: string[] | null } | null;
    const message = typeof body?.message === 'string' && body.message ? body.message : undefined;
    switch (error.status) {
      case 400: {
        const ids = body?.resultIds ?? [];
        const suffix = ids.length ? ` (${ids.length} unknown result id(s))` : '';
        return `${message ?? 'The request was rejected'}${suffix}.`;
      }
      case 403:
        return 'You do not have permission to do this.';
      case 404:
        return 'Not found. It may have been removed.';
      case 409: {
        const docs = body?.documentIds ?? [];
        const suffix = docs.length ? ` ${docs.length} report(s) are already awaiting review or processed.` : '';
        return `${message ?? 'Someone else changed this first. Reload and try again.'}${suffix}`;
      }
    }
    return message ?? `Request failed (${error.status || 'network error'}).`;
  }
  return 'Request failed.';
}
