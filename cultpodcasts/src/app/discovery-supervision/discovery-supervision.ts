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
export const CURATOR_ROLE = 'Curator';

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

/** Discovery page: full curators and supervised curators (curate / curate:supervised). */
export function canCurateDiscovery(roles: readonly string[]): boolean {
  return roles.includes(CURATOR_ROLE) || roles.includes(SUPERVISED_CURATOR_ROLE);
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

const providerLabels: Record<string, string> = {
  'auth0': 'Auth0 user',
  'google-oauth2': 'Google user',
  'github': 'GitHub user',
  'windowslive': 'Microsoft user',
  'apple': 'Apple user'
};

/**
 * Friendly label for an Auth0 subject (the API returns only subjects): 'you' for the signed-in user,
 * otherwise provider + last four characters, e.g. 'Google user …1962'. Full subject belongs in a tooltip.
 */
export function subjectLabel(subject: string | null | undefined, currentSubject?: string | null): string {
  if (!subject) return 'unknown';
  if (currentSubject && subject === currentSubject) return 'you';
  const bar = subject.indexOf('|');
  if (bar < 0) return subject.length > 16 ? `…${subject.slice(-4)}` : subject;
  const provider = subject.slice(0, bar);
  const id = subject.slice(bar + 1);
  return `${providerLabels[provider] ?? provider} …${id.slice(-4)}`;
}

export type ItemChipTone = 'success' | 'added' | 'removed' | 'error' | 'neutral';

/** One compact status chip per result card, combining pick and ingest outcome. Null = no chip (not picked, nothing happened). */
export function itemChip(pick: PickState, outcome: DiscoverySubmissionItemOutcome | null | undefined): { text: string; tone: ItemChipTone } | null {
  if (outcome?.state === 'Failed') {
    return { text: `Failed: ${outcome.error ?? outcome.message ?? 'unknown error'}`, tone: 'error' };
  }
  const suffix = outcome?.state === 'Succeeded' ? ' · Created' : outcome?.state === 'Abandoned' ? ' · Abandoned' : '';
  switch (pick) {
    case 'kept': return { text: `Kept${suffix}`, tone: suffix === ' · Created' ? 'success' : 'neutral' };
    case 'added': return { text: `Added by supervisor${suffix}`, tone: 'added' };
    case 'removed': return { text: 'Removed', tone: 'removed' };
    default: return outcome ? { text: outcome.state, tone: 'neutral' } : null;
  }
}

/** Distinct episode ids of Succeeded item outcomes, in outcome order. */
export function succeededEpisodeIds(outcomes: readonly DiscoverySubmissionItemOutcome[] | null | undefined): string[] {
  const ids: string[] = [];
  for (const o of outcomes ?? []) {
    if (o.state === 'Succeeded' && o.episodeId && !ids.includes(o.episodeId)) {
      ids.push(o.episodeId);
    }
  }
  return ids;
}

/** Route commands for the episode edit page for the given ids (same shape as normal discovery submit). */
export function episodesReviewRoute(episodeIds: readonly string[]): string[] {
  return ['/episodes', JSON.stringify(episodeIds)];
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

/** Statuses an admin may set via Change state (Jon: never Applying). */
export const ADMIN_SETTABLE_STATUSES: readonly DiscoverySubmissionStatus[] = ['Pending', 'Applied', 'ApplyFailed', 'PartiallyApplied', 'Released'];

/** History line text; StateChanged shows `from → to` and the reason. */
export function historyText(h: { action: string; fromStatus?: string | null; toStatus?: string | null; reason?: string | null }): string {
  if (h.action === 'StateChanged') {
    const change = `State changed ${h.fromStatus ?? '?'} → ${h.toStatus ?? '?'}`;
    return h.reason ? `${change}: ${h.reason}` : change;
  }
  return h.action;
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
