import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IndexDialogComponent, IndexDialogData } from './index-dialog/index-dialog.component';
import { PodcastIndexDialogResult } from './index-podcast-response.interface';

export type OpenPodcastIndexOptions = {
  /** Full-catalogue walk (`?backlog=true`). Default false = hub short lookback. */
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

/** Snackbar for an Index dialog close from Edit / Add Podcast (no episode Review navigation). */
export function notifyPodcastIndexDialogResult(
  snackBar: MatSnackBar,
  result: PodcastIndexDialogResult | undefined
): void {
  if (!result) {
    return;
  }
  if (result.updated) {
    let message = 'Podcast Indexed';
    if (result.episodeIds && result.episodeIds.length > 0) {
      const n = result.episodeIds.length;
      message += `. ${n} episode${n > 1 ? 's' : ''} updated`;
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
