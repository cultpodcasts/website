import { HttpErrorResponse } from '@angular/common/http';
import {
  canEditReview, ADMIN_SETTABLE_STATUSES, historyText, inProgressLabel, canRelease, canRetry, canSeeSubmissions, describeSubmissionError, initialFinalIds,
  isSupervisorRole, mapToComments, commentsToMap, pickDiff, pickState, submissionStatusLabel
} from './discovery-supervision';
import { DiscoverySubmissionDetail } from './discovery-supervision.models';

function detail(overrides: Partial<DiscoverySubmissionDetail> = {}): DiscoverySubmissionDetail {
  return {
    id: 's1', status: 'Pending', etag: 'e1', canReview: true, submitterSubject: 'ai', submittedAt: new Date('2026-10-11T10:00:00Z'),
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

  it('blocks every supervisor action while Applying ', () => {
    const applying = detail({ status: 'Applying', inProgressOperation: 'Apply', inProgressSince: new Date('2026-10-11T10:00:00Z'),
      itemOutcomes: [{ resultId: 'a', state: 'Failed', attempts: 1 }] });
    expect(canEditReview(applying)).toBe(false);
    expect(canRetry(applying)).toBe(false);
    expect(canRelease(applying)).toBe(false);
    expect(submissionStatusLabel('Applying')).toBe('In progress');
    expect(inProgressLabel('Retry')).toBe('Retrying failed items');
  });

  it('never offers Applying as an admin-settable status', () => {
    expect([...ADMIN_SETTABLE_STATUSES]).toEqual(['Pending', 'Applied', 'ApplyFailed', 'PartiallyApplied', 'Released']);
  });

  it('describes StateChanged history with from → to and the reason', () => {
    expect(historyText({ action: 'StateChanged', fromStatus: 'Applying', toStatus: 'Pending', reason: 'crashed' }))
      .toBe('State changed Applying → Pending: crashed');
    expect(historyText({ action: 'StateChanged', fromStatus: 'Applying', toStatus: 'Released', reason: null }))
      .toBe('State changed Applying → Released');
    expect(historyText({ action: 'Applied' })).toBe('Applied');
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

describe('succeededEpisodeIds / episodesReviewRoute', () => {
  it('collects distinct episode ids of succeeded outcomes only', async () => {
    const { succeededEpisodeIds, episodesReviewRoute } = await import('./discovery-supervision');
    expect(succeededEpisodeIds([
      { resultId: 'a', state: 'Succeeded', attempts: 1, episodeId: 'e1' },
      { resultId: 'b', state: 'Failed', attempts: 1, episodeId: 'e2' },
      { resultId: 'c', state: 'Succeeded', attempts: 1, episodeId: null },
      { resultId: 'd', state: 'Succeeded', attempts: 1, episodeId: 'e1' },
      { resultId: 'e', state: 'Abandoned', attempts: 1 }
    ] as never)).toEqual(['e1']);
    expect(succeededEpisodeIds(null)).toEqual([]);
    expect(episodesReviewRoute(['e1', 'e2'])).toEqual(['/episodes', '["e1","e2"]']);
  });
});

describe('menu visibility helpers', () => {
  it('shows Discovery to curators and supervised curators only', async () => {
    const { canCurateDiscovery } = await import('./discovery-supervision');
    expect(canCurateDiscovery(['Curator'])).toBe(true);
    expect(canCurateDiscovery(['SupervisedCurator'])).toBe(true);
    expect(canCurateDiscovery(['Supervisor'])).toBe(false);
    expect(canCurateDiscovery([])).toBe(false);
  });

  it('shows Discovery review to supervisors and admins only', async () => {
    const { isSupervisorRole } = await import('./discovery-supervision');
    expect(isSupervisorRole(['Supervisor'])).toBe(true);
    expect(isSupervisorRole(['Admin'])).toBe(true);
    expect(isSupervisorRole(['Curator', 'SupervisedCurator'])).toBe(false);
  });
});

describe('subjectLabel / itemChip', () => {
  it('labels subjects without exposing raw ids', async () => {
    const { subjectLabel } = await import('./discovery-supervision');
    expect(subjectLabel('google-oauth2|117468924423760161962', 'google-oauth2|117468924423760161962')).toBe('you');
    expect(subjectLabel('google-oauth2|117468924423760161962')).toBe('Google user …1962');
    expect(subjectLabel('auth0|6ac8a829530ac245fc494731')).toBe('Auth0 user …4731');
    expect(subjectLabel('custom|abcdef1234')).toBe('custom …1234');
    expect(subjectLabel(null)).toBe('unknown');
  });

  it('combines pick and outcome into one chip', async () => {
    const { itemChip } = await import('./discovery-supervision');
    expect(itemChip('kept', { resultId: 'a', state: 'Succeeded', attempts: 1 })).toEqual({ text: 'Kept · Created', tone: 'success' });
    expect(itemChip('kept', undefined)).toEqual({ text: 'Kept', tone: 'neutral' });
    expect(itemChip('added', { resultId: 'a', state: 'Succeeded', attempts: 1 })).toEqual({ text: 'Added by supervisor · Created', tone: 'added' });
    expect(itemChip('removed', undefined)).toEqual({ text: 'Removed', tone: 'removed' });
    expect(itemChip('kept', { resultId: 'a', state: 'Failed', attempts: 1, error: 'Timeout' })).toEqual({ text: 'Failed: Timeout', tone: 'error' });
    expect(itemChip('none', undefined)).toBeNull();
  });
});
