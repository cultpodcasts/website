import { HttpErrorResponse } from '@angular/common/http';
import {
  canEditReview, canRecover, inProgressLabel, canRelease, canRetry, canSeeSubmissions, describeSubmissionError, initialFinalIds,
  isSupervisorRole, mapToComments, commentsToMap, pickDiff, pickState, submissionStatusLabel
} from './discovery-supervision';
import { DiscoverySubmissionDetail } from './discovery-supervision.models';

function detail(overrides: Partial<DiscoverySubmissionDetail> = {}): DiscoverySubmissionDetail {
  return {
    id: 's1', status: 'Pending', etag: 'e1', canReview: true, submitterSubject: 'ai', submittedAt: '2026-10-11T10:00:00Z',
    submitterAcceptedResultIds: ['a', 'b'], itemComments: [], reports: [], history: [], ...overrides
  };
}

describe('discovery supervision helpers', () => {
  it('classifies each result against the submitter picks and the final set', () => {
    expect(pickState('a', ['a'], ['a'])).toBe('kept');
    expect(pickState('c', ['a'], ['a', 'c'])).toBe('added');
    expect(pickState('a', ['a'], [])).toBe('removed');
    expect(pickState('z', ['a'], ['a'])).toBe('none');
    expect(pickDiff(['a', 'b'], ['b', 'c'])).toEqual({ added: ['c'], removed: ['a'] });
  });

  it('starts the working set from the saved review, else the submitter picks', () => {
    expect(initialFinalIds(detail())).toEqual(['a', 'b']);
    expect(initialFinalIds(detail({ supervisorAcceptedResultIds: ['c'] }))).toEqual(['c']);
    expect(initialFinalIds(detail({ supervisorAcceptedResultIds: [] }))).toEqual([]);
  });

  it('round-trips item comments and drops blanks', () => {
    const map = commentsToMap([{ resultId: 'a', comment: 'missed guest' }]);
    expect(mapToComments({ ...map, b: '   ', c: ' wrong show ' })).toEqual([
      { resultId: 'a', comment: 'missed guest' },
      { resultId: 'c', comment: 'wrong show' }
    ]);
  });

  it('gates review, retry and release by status, canReview and outcomes', () => {
    expect(canEditReview(detail())).toBe(true);
    expect(canEditReview(detail({ canReview: false }))).toBe(false);
    expect(canEditReview(detail({ status: 'Applied' }))).toBe(false);

    const failed = { resultId: 'a', state: 'Failed' as const, attempts: 1, error: 'boom' };
    const ok = { resultId: 'b', state: 'Succeeded' as const, attempts: 1 };
    expect(canRetry(detail({ status: 'PartiallyApplied', itemOutcomes: [failed, ok] }))).toBe(true);
    expect(canRetry(detail({ status: 'PartiallyApplied', itemOutcomes: [ok] }))).toBe(false);
    expect(canRetry(detail({ status: 'PartiallyApplied', itemOutcomes: [failed], canReview: false }))).toBe(false);

    expect(canRelease(detail())).toBe(true);
    expect(canRelease(detail({ status: 'ApplyFailed', itemOutcomes: [failed] }))).toBe(true);
    expect(canRelease(detail({ status: 'PartiallyApplied', itemOutcomes: [failed, ok] }))).toBe(false);
    expect(canRelease(detail({ status: 'Released' }))).toBe(false);
  });

  it('maps roles to supervisor and submission access', () => {
    expect(isSupervisorRole(['Supervisor'])).toBe(true);
    expect(isSupervisorRole(['Admin'])).toBe(true);
    expect(isSupervisorRole(['Curator', 'SupervisedCurator'])).toBe(false);
    expect(canSeeSubmissions(['Curator', 'SupervisedCurator'])).toBe(true);
    expect(canSeeSubmissions(['Curator'])).toBe(false);
  });

  it('blocks every supervisor action while Applying and lets admins recover after 30 minutes', () => {
    const applying = detail({ status: 'Applying', inProgressOperation: 'Apply', inProgressSince: '2026-10-11T10:00:00Z',
      itemOutcomes: [{ resultId: 'a', state: 'Failed', attempts: 1 }] });
    expect(canEditReview(applying)).toBe(false);
    expect(canRetry(applying)).toBe(false);
    expect(canRelease(applying)).toBe(false);
    expect(canRecover(applying, true, new Date('2026-10-11T10:31:00Z'))).toBe(true);
    expect(canRecover(applying, true, new Date('2026-10-11T10:29:00Z'))).toBe(false);
    expect(canRecover(applying, false, new Date('2026-10-11T12:00:00Z'))).toBe(false);
    expect(canRecover(detail({ inProgressSince: '2026-10-11T08:00:00Z' }), true, new Date('2026-10-11T12:00:00Z'))).toBe(false);
    expect(submissionStatusLabel('Applying')).toBe('In progress');
    expect(inProgressLabel('Retry')).toBe('Retrying failed items');
  });

  it('labels statuses', () => {
    expect(submissionStatusLabel('Pending')).toBe('Awaiting review');
    expect(submissionStatusLabel('PartiallyApplied')).toBe('Partially applied');
  });

  it('explains 409 and 400 submit failures', () => {
    expect(describeSubmissionError(new HttpErrorResponse({
      status: 409, error: { message: 'Reports not available', documentIds: ['d1', 'd2'] }
    }))).toBe('Reports not available 2 report(s) are already awaiting review or processed.');
    expect(describeSubmissionError(new HttpErrorResponse({
      status: 400, error: { message: 'Unknown result ids', resultIds: ['x'] }
    }))).toBe('Unknown result ids (1 unknown result id(s)).');
    expect(describeSubmissionError(new HttpErrorResponse({ status: 409, error: null })))
      .toBe('Someone else changed this first. Reload and try again.');
    expect(describeSubmissionError(new HttpErrorResponse({ status: 409, error: { message: 'Stale etag', documentIds: null } })))
      .toBe('Stale etag');
    expect(describeSubmissionError(new Error('x'))).toBe('Request failed.');
  });
});
