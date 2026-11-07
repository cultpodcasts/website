import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IndexDialogComponent, IndexDialogData } from './index-dialog/index-dialog.component';
import { PodcastIndexDialogResult } from './index-podcast-response.interface';

/** Opens the curator Index progress dialog for a podcast (same POST as the hub Index menu). */
export function openPodcastIndexDialog(dialog: MatDialog, podcastName: string) {
  const data: IndexDialogData = { kind: 'podcast', name: podcastName };
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
  }
}
