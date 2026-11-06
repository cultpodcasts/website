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
  delayMs,
  enqueueShapeFromJob,
  isConflictStatus,
  isJobCompleted,
  isJobFailed,
  isRecoverableTransferTransportError,
  isTransferComplete,
  transferInProgressFromError,
  transferKindPollDelaysMs
} from '../transfer-podcast-kind-recover';
import { TransferPodcastKindSendClose } from '../transfer-podcast-kind-send-close.interface';
import { youtubePlaylistEditError } from '../youtube-playlist-edit-error';

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
  readonly errorMessage = signal('An error occurred transferring the podcast');
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

  /** Re-posts the same transfer when the Api said the playlist ownership check was retryable. */
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
    this.errorMessage.set('An error occurred transferring the podcast');
    this.progressMessage.set('Transferring podcast…');
    try {
      const resp = await firstValueFrom(this.curationSubmit.postPodcastKind(podcastId, targetKind));
      // 202 Queued: poll GET /podcast/:id/kind until a terminal status.
      await this.finishFromJobStatus(podcastId, targetKind, resp.body);
    } catch (error) {
      await this.handleFailure(error, podcastId, targetKind);
    }
  }

  private async handleFailure(
    error: unknown,
    podcastId: string,
    targetKind: CatalogueParentKind
  ) {
    if (transferInProgressFromError(error)) {
      this.progressMessage.set('Transfer already running');
      const job = await this.pollJobUntilTerminal(podcastId);
      if (job && isJobCompleted(job.status)) {
        this.closeTransferred(targetKind, enqueueShapeFromJob(job));
        return;
      }
      if (job && isJobFailed(job.status)) {
        this.failJob(job);
        return;
      }
      this.fail(error);
      return;
    }

    if (isConflictStatus(error) || isRecoverableTransferTransportError(error)) {
      if (isRecoverableTransferTransportError(error)) {
        this.progressMessage.set('Checking transfer status…');
      } else {
        this.progressMessage.set('Checking whether the podcast was already transferred…');
      }
      const job = await this.pollJobUntilTerminal(podcastId);
      if (job && isJobCompleted(job.status)) {
        this.closeTransferred(targetKind, enqueueShapeFromJob(job));
        return;
      }
      if (job && isJobFailed(job.status)) {
        this.failJob(job);
        return;
      }
      // Fallback when GET status is Idle/404 but the row move already finished.
      const completed = await this.checkTransferred(podcastId, targetKind);
      if (completed) {
        this.closeTransferred(targetKind, {
          parentId: podcastId,
          targetKind
        });
        return;
      }
      this.fail(error);
      return;
    }

    this.fail(error);
  }

  private async finishFromJobStatus(
    podcastId: string,
    targetKind: CatalogueParentKind,
    body: PodcastKindTransferResponse | null | undefined
  ) {
    this.progressMessage.set('Transfer queued. Checking that it finished…');
    const job = await this.pollJobUntilTerminal(podcastId);
    if (job && isJobCompleted(job.status)) {
      this.closeTransferred(targetKind, enqueueShapeFromJob(job) ?? body ?? { parentId: podcastId, targetKind });
      return;
    }
    if (job && isJobFailed(job.status)) {
      this.failJob(job);
      return;
    }
    this.isSending.set(false);
    this.sendError.set(true);
    this.retryable.set(true);
    this.progressMessage.set('');
    this.errorMessage.set(
      'The transfer has not finished. The podcast was not confirmed as moved, so the episodes should still be on the podcast. Wait a few minutes and try again.'
    );
  }

  private async pollJobUntilTerminal(
    podcastId: string
  ): Promise<PodcastKindTransferJobStatusResponse | null> {
    let latest = await this.readJob(podcastId);
    if (latest && (isJobCompleted(latest.status) || isJobFailed(latest.status))) {
      return latest;
    }
    for (const waitMs of transferKindPollDelaysMs()) {
      await delayMs(waitMs);
      latest = await this.readJob(podcastId);
      if (latest && (isJobCompleted(latest.status) || isJobFailed(latest.status))) {
        return latest;
      }
    }
    return latest;
  }

  private async readJob(podcastId: string): Promise<PodcastKindTransferJobStatusResponse | null> {
    return firstValueFrom(
      this.curationSubmit.getPodcastKind(podcastId).pipe(
        map(job => job),
        catchError((err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 404) {
            return of(null);
          }
          return of(null);
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
        catchError((err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 404) {
            return of(true);
          }
          return of(false);
        })
      )
    );
    return isTransferComplete(parentExists, podcastGone);
  }

  private closeTransferred(
    targetKind: CatalogueParentKind,
    body: PodcastKindTransferResponse | null | undefined
  ) {
    this.dialogRef.close({
      transferred: true,
      targetKind,
      parentId: body?.parentId,
      response: body
    });
  }

  private failJob(job: PodcastKindTransferJobStatusResponse) {
    this.isSending.set(false);
    this.sendError.set(true);
    this.retryable.set(job.status === 'Incomplete');
    this.progressMessage.set('');
    this.errorMessage.set(
      job.failureReason?.trim()
        || (job.status === 'Incomplete'
          ? 'The transfer did not finish. Wait a few minutes and try again.'
          : 'The transfer failed.')
    );
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
