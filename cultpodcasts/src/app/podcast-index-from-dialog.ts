import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import {
  IndexBacklogConfirmDialogComponent,
  IndexBacklogConfirmDialogData
} from './index-backlog-confirm-dialog/index-backlog-confirm-dialog.component';
import { IndexDialogComponent, IndexDialogData } from './index-dialog/index-dialog.component';
import { PodcastIndexDialogResult } from './index-podcast-response.interface';

export type OpenPodcastIndexOptions = {
  /** Full-catalogue walk (`POST /podcast/index/{name}/backlog`). Default false = hub short lookback. */
  backlog?: boolean;
};

/** Opens the curator Index progress dialog for a podcast. Hub Index omits backlog; Edit/Add pass `{ backlog: true }`. */
export function openPodcastIndexDialog(
  dialog: MatDialog,
  podcastName: string,
  options?: OpenPodcastIndexOptions
) {
  const data: IndexDialogData = {
    kind: 'podcast',
    name: podcastName,
    ...(options?.backlog ? { backlog: true } : {})
  };
  return dialog.open<IndexDialogComponent, IndexDialogData, PodcastIndexDialogResult>(
    IndexDialogComponent,
    { disableClose: true, autoFocus: true, data }
  );
}

/**
 * Admin backlog index: first shows how many episodes the full walk would ingest (a dry run, nothing is saved),
 * and only on Confirm runs the backlog Index. Cancel (or closing the confirmation) does nothing.
 * When the index finishes, the snackbar offers Review, which opens the updated episodes (#1433).
 */
export function confirmAndIndexPodcastBacklog(
  dialog: MatDialog,
  snackBar: MatSnackBar,
  router: Router,
  podcastName: string
): void {
  dialog
    .open<IndexBacklogConfirmDialogComponent, IndexBacklogConfirmDialogData, boolean>(
      IndexBacklogConfirmDialogComponent,
      { autoFocus: true, data: { podcastName } }
    )
    .afterClosed()
    .subscribe(confirmed => {
      if (confirmed !== true) {
        return;
      }
      openPodcastIndexDialog(dialog, podcastName, { backlog: true })
        .afterClosed()
        .subscribe(result => {
          notifyPodcastIndexDialogResult(snackBar, result, episodeIds => {
            void router.navigate(['/episodes', JSON.stringify(episodeIds)]);
          });
        });
    });
}

/**
 * Snackbar for Index dialog closes that are not hub `updated` + Review navigation:
 * Edit/Add backlog, and hub Index non-success outcomes (including 409/504).
 * When `onReview` is given and episodes were updated, the action is Review and it calls `onReview` with their ids.
 */
export function notifyPodcastIndexDialogResult(
  snackBar: MatSnackBar,
  result: PodcastIndexDialogResult | undefined,
  onReview?: (episodeIds: string[]) => void
): void {
  if (!result) {
    return;
  }
  if (result.updated) {
    let message = 'Podcast Indexed';
    const episodeIds = result.episodeIds ?? [];
    if (episodeIds.length > 0) {
      const n = episodeIds.length;
      message += `. ${n} episode${n > 1 ? 's' : ''} updated`;
    }
    if (onReview && episodeIds.length > 0) {
      const ref = snackBar.open(message, 'Review', { duration: 10000 });
      ref.onAction().subscribe(() => onReview(episodeIds));
      return;
    }
    snackBar.open(message, 'Ok', { duration: 10000 });
    return;
  }
  if (result.podcastNotAutoIndex) {
    snackBar.open('Podcast not indexable', 'Ok', { duration: 10000 });
    return;
  }
  if (result.podcastNotFound) {
    snackBar.open('Podcast not found', 'Ok', { duration: 10000 });
    return;
  }
  if (result.alreadyRunning) {
    snackBar.open('Podcast indexing already running. Try again shortly.', 'Ok', { duration: 10000 });
    return;
  }
  if (result.timedOut) {
    snackBar.open(
      'Podcast indexing ran out of time. Anything it saved will appear shortly; try again later.',
      'Ok',
      { duration: 10000 }
    );
  }
}
