import { HttpErrorResponse } from '@angular/common/http';
import { CatalogueParentKind } from './catalogue-parent-kind.enum';
import {
  PodcastKindTransferJobStatus,
  PodcastKindTransferJobStatusResponse
} from './podcast-kind-transfer-response.interface';
import {
  enqueueShapeFromJob,
  isConflictStatus,
  isJobCompleted,
  isJobFailed,
  isJobReadDenied,
  isJobTerminal,
  isRecoverableTransferTransportError,
  isTransferComplete,
  KindTransferJobRead,
  pollKindTransferJob,
  transferInProgressFromError,
  transferKindPollDelaysMs,
  TRANSFER_KIND_POLL_BUDGET_MS
} from './transfer-podcast-kind-recover';
import {
  YOU_TUBE_PLAYLIST_LOOKUP_FAILED,
  YOU_TUBE_PLAYLIST_NOT_FOUND
} from './youtube-playlist-edit-error';

describe('transfer-podcast-kind-recover', () => {
  it('builds backoff delays that sum to the ~2 minute poll budget', () => {
    const delays = transferKindPollDelaysMs();
    expect(delays.reduce((sum, ms) => sum + ms, 0)).toBe(TRANSFER_KIND_POLL_BUDGET_MS);
    expect(delays[0]).toBe(2_000);
    expect(delays.every(ms => ms <= 30_000)).toBe(true);
  });

  it('treats network, timeout, 499 and plain 5xx as recoverable transport errors', () => {
    expect(isRecoverableTransferTransportError(new HttpErrorResponse({ status: 0 }))).toBe(true);
    expect(isRecoverableTransferTransportError(new HttpErrorResponse({ status: 408 }))).toBe(true);
    expect(isRecoverableTransferTransportError(new HttpErrorResponse({ status: 499 }))).toBe(true);
    expect(isRecoverableTransferTransportError(new HttpErrorResponse({ status: 500 }))).toBe(true);
    expect(isRecoverableTransferTransportError(new HttpErrorResponse({ status: 504 }))).toBe(true);
    expect(isRecoverableTransferTransportError(new HttpErrorResponse({ status: 400 }))).toBe(false);
    expect(isRecoverableTransferTransportError(new HttpErrorResponse({ status: 404 }))).toBe(false);
    expect(isRecoverableTransferTransportError(new Error('boom'))).toBe(false);
  });

  it('does not treat playlist ownership ApiErrors as recoverable transport (transfer never wrote)', () => {
    expect(isRecoverableTransferTransportError(new HttpErrorResponse({
      status: 503,
      error: {
        error: 'Could not check',
        code: YOU_TUBE_PLAYLIST_LOOKUP_FAILED,
        retryable: true
      }
    }))).toBe(false);
    expect(isRecoverableTransferTransportError(new HttpErrorResponse({
      status: 400,
      error: { error: 'Playlist missing', code: YOU_TUBE_PLAYLIST_NOT_FOUND }
    }))).toBe(false);
  });

  it('reads transferInProgress or status AlreadyRunning from a 409 body', () => {
    expect(transferInProgressFromError(new HttpErrorResponse({
      status: 409,
      error: { transferInProgress: true }
    }))).toBe(true);
    expect(transferInProgressFromError(new HttpErrorResponse({
      status: 409,
      error: { status: 'AlreadyRunning' }
    }))).toBe(true);
    expect(transferInProgressFromError(new HttpErrorResponse({
      status: 409,
      error: { parentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }
    }))).toBe(false);
    expect(transferInProgressFromError(new HttpErrorResponse({
      status: 500,
      error: { transferInProgress: true }
    }))).toBe(false);
  });

  it('detects 409 conflict status', () => {
    expect(isConflictStatus(new HttpErrorResponse({ status: 409 }))).toBe(true);
    expect(isConflictStatus(new HttpErrorResponse({ status: 500 }))).toBe(false);
  });

  it('is complete only when the target parent exists and the podcast is gone', () => {
    expect(isTransferComplete(true, true)).toBe(true);
    expect(isTransferComplete(true, false)).toBe(false);
    expect(isTransferComplete(false, true)).toBe(false);
    expect(isTransferComplete(false, false)).toBe(false);
  });

  describe('job status classification', () => {
    const cases: ReadonlyArray<[PodcastKindTransferJobStatus, boolean, boolean, boolean]> = [
      // status, completed, failed, terminal
      ['Idle', false, false, false],
      ['Queued', false, false, false],
      ['Running', false, false, false],
      ['Completed', true, false, true],
      ['Failed', false, true, true],
      ['Incomplete', false, true, true]
    ];

    it.each(cases)('classifies %s', (status, completed, failed, terminal) => {
      expect(isJobCompleted(status)).toBe(completed);
      expect(isJobFailed(status)).toBe(failed);
      expect(isJobTerminal(status)).toBe(terminal);
    });
  });

  describe('enqueueShapeFromJob', () => {
    const podcastId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    it('uses the job parent, kind and playable fields when present', () => {
      const shape = enqueueShapeFromJob({
        status: 'Completed',
        parentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        targetKind: CatalogueParentKind.NewsOrganisation,
        playableCount: 3,
        failureIndexingPlayables: true
      }, podcastId, CatalogueParentKind.TvShow);
      expect(shape).toEqual({
        parentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        targetKind: CatalogueParentKind.NewsOrganisation,
        playableCount: 3,
        failureIndexingPlayables: true
      });
    });

    it.each([null, undefined])('falls back to the podcast id and requested kind when parent/kind are %s', missing => {
      const shape = enqueueShapeFromJob(
        { status: 'Completed', parentId: missing, targetKind: missing },
        podcastId,
        CatalogueParentKind.TvShow);
      expect(shape.parentId).toBe(podcastId);
      expect(shape.targetKind).toBe(CatalogueParentKind.TvShow);
    });
  });

  describe('isJobReadDenied', () => {
    it.each([401, 403])('treats %i as denied', status => {
      expect(isJobReadDenied(new HttpErrorResponse({ status }))).toBe(true);
    });

    it.each([0, 404, 500, 503])('treats %i as retry-able', status => {
      expect(isJobReadDenied(new HttpErrorResponse({ status }))).toBe(false);
    });

    it('ignores non-HTTP errors', () => {
      expect(isJobReadDenied(new Error('boom'))).toBe(false);
    });
  });

  describe('pollKindTransferJob', () => {
    const job = (status: PodcastKindTransferJobStatus): KindTransferJobRead => ({
      kind: 'job',
      job: { status } as PodcastKindTransferJobStatusResponse
    });
    const unavailable: KindTransferJobRead = { kind: 'unavailable' };

    function sequence(...reads: KindTransferJobRead[]) {
      let i = 0;
      const read = vi.fn(async () => reads[Math.min(i++, reads.length - 1)]);
      return read;
    }

    const noWait = () => Promise.resolve();

    it('returns terminal on the first read without waiting', async () => {
      const wait = vi.fn(noWait);
      const read = sequence(job('Completed'));
      const result = await pollKindTransferJob(read, { idleGraceReads: 1, wait });
      expect(result.kind).toBe('terminal');
      expect(read).toHaveBeenCalledTimes(1);
      expect(wait).not.toHaveBeenCalled();
    });

    it('keeps polling Queued/Running until terminal', async () => {
      const read = sequence(job('Queued'), job('Running'), job('Failed'));
      const result = await pollKindTransferJob(read, { idleGraceReads: 1, delaysMs: [1, 1, 1], wait: noWait });
      expect(result.kind).toBe('terminal');
      expect(read).toHaveBeenCalledTimes(3);
    });

    it('returns pending when the budget ends on Running', async () => {
      const read = sequence(job('Running'));
      const result = await pollKindTransferJob(read, { idleGraceReads: 1, delaysMs: [1, 1], wait: noWait });
      expect(result.kind).toBe('pending');
      expect(read).toHaveBeenCalledTimes(3);
    });

    it('stops on Idle after the grace re-reads instead of exhausting the budget', async () => {
      const read = sequence(job('Idle'));
      const result = await pollKindTransferJob(read, {
        idleGraceReads: 1,
        delaysMs: [1, 1, 1, 1, 1],
        wait: noWait
      });
      expect(result.kind).toBe('idle');
      expect(read).toHaveBeenCalledTimes(2);
    });

    it('allows more Idle reads when the grace is larger, and recovers if the job appears', async () => {
      const read = sequence(job('Idle'), job('Idle'), job('Completed'));
      const result = await pollKindTransferJob(read, { idleGraceReads: 3, delaysMs: [1, 1, 1], wait: noWait });
      expect(result.kind).toBe('terminal');
      expect(read).toHaveBeenCalledTimes(3);
    });

    it('returns denied immediately and does not wait', async () => {
      const error = new HttpErrorResponse({ status: 403 });
      const wait = vi.fn(noWait);
      const read = sequence({ kind: 'denied', error });
      const result = await pollKindTransferJob(read, { idleGraceReads: 1, wait });
      expect(result).toEqual({ kind: 'denied', error });
      expect(read).toHaveBeenCalledTimes(1);
      expect(wait).not.toHaveBeenCalled();
    });

    it('returns unavailable when every read is unavailable', async () => {
      const read = sequence(unavailable);
      const result = await pollKindTransferJob(read, { idleGraceReads: 1, delaysMs: [1, 1], wait: noWait });
      expect(result.kind).toBe('unavailable');
      expect(read).toHaveBeenCalledTimes(3);
    });

    it('recovers from a transient unavailable read', async () => {
      const read = sequence(unavailable, job('Completed'));
      const result = await pollKindTransferJob(read, { idleGraceReads: 1, delaysMs: [1, 1], wait: noWait });
      expect(result.kind).toBe('terminal');
    });

    it('waits the supplied delays between reads', async () => {
      const waited: number[] = [];
      const wait = async (ms: number) => { waited.push(ms); };
      const read = sequence(job('Running'));
      await pollKindTransferJob(read, { idleGraceReads: 1, delaysMs: [5, 10], wait });
      expect(waited).toEqual([5, 10]);
    });
  });
});
