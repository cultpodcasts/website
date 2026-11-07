import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, firstValueFrom, map, of } from 'rxjs';
import { CatalogueParentKind } from '../catalogue-parent-kind.enum';
import { hubForParentKind } from '../catalogue-hub';
import { CurationSubmitService } from '../curation-submit.service';
import {
  PodcastKindTransferJobStatusResponse,
  PodcastKindTransferResponse
} from '../podcast-kind-transfer-response.interface';
import {
  enqueueShapeFromJob,
  IDLE_GRACE_READS_ACCEPTED,
  IDLE_GRACE_READS_RECOVERY,
  isConflictStatus,
  isJobCompleted,
  isJobReadDenied,
  isRecoverableTransferTransportError,
  isTransferComplete,
  KindTransferJobRead,
  pollKindTransferJob,
  transferInProgressFromError
} from '../transfer-podcast-kind-recover';
import { TransferPodcastKindSendClose } from '../transfer-podcast-kind-send-close.interface';
import { youtubePlaylistEditError } from '../youtube-playlist-edit-error';

/** What {@link TransferPodcastKindSendComponent.resolveTransfer} concluded. */
type TransferOutcome =
  | { kind: 'completed'; result: PodcastKindTransferResponse }
  | { kind: 'failed'; job: PodcastKindTransferJobStatusResponse }
  /** GET still says Queued / Running when the poll budget ran out. */
  | { kind: 'pending' }
  /** Status GET is not permitted (401/403). */
  | { kind: 'denied'; error: unknown }
  /** Neither status nor the parent/podcast fallback confirmed the move. */
  | { kind: 'unconfirmed' };

const DEFAULT_ERROR_MESSAGE = 'An error occurred transferring the podcast';

export const TRANSFER_STILL_RUNNING_MESSAGE =
  'The transfer is still running. Check back in a few minutes, or choose Try again to keep waiting for it.';

export const TRANSFER_UNCONFIRMED_MESSAGE =
  'The transfer was accepted but its status could not be confirmed, so the podcast is not confirmed as moved. Wait a few minutes and try again.';

@Component({
  selector: 'app-transfer-podcast-kind-send',
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './transfer-podcast-kind-send.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './transfer-podcast-kind-send.component.sass'
})
export class TransferPodcastKindSendComponent {
  readonly isSending = signal(true);
  readonly sendError = signal(false);
  readonly progressMessage = signal('Transferring podcast…');
  readonly errorMessage = signal(DEFAULT_ERROR_MESSAGE);
  readonly retryable = signal(false);
  private podcastId: string | undefined;
  private targetKind: CatalogueParentKind | undefined;

  constructor(
    private dialogRef: MatDialogRef<TransferPodcastKindSendComponent, TransferPodcastKindSendClose>,
    private curationSubmit: CurationSubmitService) {
  }

  public submit(podcastId: string, targetKind: CatalogueParentKind) {
    this.podcastId = podcastId;
    this.targetKind = targetKind;
    void this.runTransfer(podcastId, targetKind);
  }

  /** Re-posts the same transfer when the Api said the failure is retryable. */
  retry() {
    if (!this.podcastId || this.targetKind === undefined || !this.retryable()) {
      return;
    }
    void this.runTransfer(this.podcastId, this.targetKind);
  }

  private async runTransfer(podcastId: string, targetKind: CatalogueParentKind) {
    this.isSending.set(true);
    this.sendError.set(false);
    this.retryable.set(false);
    this.errorMessage.set(DEFAULT_ERROR_MESSAGE);
    this.progressMessage.set('Transferring podcast…');
    try {
      await firstValueFrom(this.curationSubmit.postPodcastKind(podcastId, targetKind));
    } catch (error) {
      await this.handleFailure(error, podcastId, targetKind);
      return;
    }
    // 202 Queued: the response is an acknowledgement; GET /podcast/:id/kind is the read model.
    this.progressMessage.set('Transfer queued. Checking that it finished…');
    const outcome = await this.resolveTransfer(podcastId, targetKind, IDLE_GRACE_READS_ACCEPTED);
    this.applyOutcome(outcome, targetKind, undefined);
  }

  /** POST failed: 409 / transport may still have enqueued or finished the move, so check. */
  private async handleFailure(
    error: unknown,
    podcastId: string,
    targetKind: CatalogueParentKind
  ) {
    const progress = this.recoveryProgressMessage(error);
    if (!progress) {
      this.fail(error);
      return;
    }
    this.progressMessage.set(progress);
    const outcome = await this.resolveTransfer(podcastId, targetKind, IDLE_GRACE_READS_RECOVERY);
    this.applyOutcome(outcome, targetKind, error);
  }

  private recoveryProgressMessage(error: unknown): string | undefined {
    if (transferInProgressFromError(error)) {
      return 'Transfer already running';
    }
    if (isRecoverableTransferTransportError(error)) {
      return 'Checking transfer status…';
    }
    if (isConflictStatus(error)) {
      return 'Checking whether the podcast was already transferred…';
    }
    return undefined;
  }

  /**
   * Polls job status; when status cannot confirm the move (Idle / unavailable) falls back to
   * the parent/podcast existence probe.
   */
  private async resolveTransfer(
    podcastId: string,
    targetKind: CatalogueParentKind,
    idleGraceReads: number
  ): Promise<TransferOutcome> {
    const poll = await pollKindTransferJob(() => this.readJob(podcastId), { idleGraceReads });
    switch (poll.kind) {
      case 'denied':
        return poll;
      case 'terminal':
        return isJobCompleted(poll.job.status)
          ? { kind: 'completed', result: enqueueShapeFromJob(poll.job, podcastId, targetKind) }
          : { kind: 'failed', job: poll.job };
      case 'pending':
        return { kind: 'pending' };
      case 'idle':
      case 'unavailable':
        return (await this.checkTransferred(podcastId, targetKind))
          ? { kind: 'completed', result: { parentId: podcastId, targetKind } }
          : { kind: 'unconfirmed' };
    }
  }

  /** `postFailure` is the POST error when the entry point was a recovery path. */
  private applyOutcome(
    outcome: TransferOutcome,
    targetKind: CatalogueParentKind,
    postFailure: unknown
  ) {
    switch (outcome.kind) {
      case 'completed':
        this.closeTransferred(targetKind, outcome.result);
        return;
      case 'failed':
        this.failJob(outcome.job);
        return;
      case 'pending':
        this.showError(TRANSFER_STILL_RUNNING_MESSAGE, true);
        return;
      case 'denied':
        this.fail(outcome.error);
        return;
      case 'unconfirmed':
        if (postFailure !== undefined) {
          this.fail(postFailure);
        } else {
          this.showError(TRANSFER_UNCONFIRMED_MESSAGE, true);
        }
        return;
    }
  }

  private readJob(podcastId: string): Promise<KindTransferJobRead> {
    return firstValueFrom(
      this.curationSubmit.getPodcastKind(podcastId).pipe(
        map((job): KindTransferJobRead => ({ kind: 'job', job })),
        catchError((error: unknown) => {
          if (isJobReadDenied(error)) {
            return of<KindTransferJobRead>({ kind: 'denied', error });
          }
          // 404 = no job recorded; 5xx / transport = unknown. Both are fail-safe "try again / probe".
          if (!(error instanceof HttpErrorResponse && error.status === 404)) {
            console.warn('Kind-transfer status GET failed', error);
          }
          return of<KindTransferJobRead>({ kind: 'unavailable' });
        })
      )
    );
  }

  /** True when the target parent exists and the podcast row is gone (legacy fallback). */
  private async checkTransferred(
    podcastId: string,
    targetKind: CatalogueParentKind
  ): Promise<boolean> {
    const hub = hubForParentKind(targetKind);
    const parentExists = await firstValueFrom(
      this.curationSubmit.getCatalogueParent(hub, podcastId).pipe(
        map(() => true),
        catchError(() => of(false))
      )
    );
    const podcastGone = await firstValueFrom(
      this.curationSubmit.getPodcast(podcastId).pipe(
        map(() => false),
        catchError((err: unknown) => of(err instanceof HttpErrorResponse && err.status === 404))
      )
    );
    return isTransferComplete(parentExists, podcastGone);
  }

  private closeTransferred(
    targetKind: CatalogueParentKind,
    body: PodcastKindTransferResponse
  ) {
    this.dialogRef.close({
      transferred: true,
      targetKind,
      parentId: body.parentId,
      response: body
    });
  }

  private failJob(job: PodcastKindTransferJobStatusResponse) {
    // Failed (queued but never started / marker expired) and Incomplete are both safe to re-POST.
    this.showError(
      job.failureReason?.trim()
        || (job.status === 'Incomplete'
          ? 'The transfer did not finish. Wait a few minutes and try again.'
          : 'The transfer failed.'),
      true
    );
  }

  private showError(message: string, retryable: boolean) {
    this.isSending.set(false);
    this.sendError.set(true);
    this.retryable.set(retryable);
    this.progressMessage.set('');
    this.errorMessage.set(message);
  }

  private fail(error: unknown) {
    this.isSending.set(false);
    this.sendError.set(true);
    this.progressMessage.set('');
    const playlist = youtubePlaylistEditError(error);
    if (playlist) {
      this.errorMessage.set(playlist.message);
      this.retryable.set(playlist.retryable);
    }
    console.error(error);
  }

  close() {
    this.dialogRef.close({ transferred: false });
  }
}
