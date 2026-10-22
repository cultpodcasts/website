import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { CataloguePlayableKind } from './catalogue-playable-kind.enum';
import { EditNewsReportDialogComponent } from './edit-news-report-dialog/edit-news-report-dialog.component';
import { EditTvShowEpisodeDialogComponent } from './edit-tv-show-episode-dialog/edit-tv-show-episode-dialog.component';
import { EditPlayableDialogResponse } from './playable-edit.interface';

/** Playable kinds with a curator edit dialog (news report, TV episode). Film is not wired yet. */
export type EditableCataloguePlayableKind = CataloguePlayableKind.NewsReport | CataloguePlayableKind.TvShowEpisode;

export function isEditableCataloguePlayableKind(kind: string | null | undefined): kind is EditableCataloguePlayableKind {
  return kind === CataloguePlayableKind.NewsReport || kind === CataloguePlayableKind.TvShowEpisode;
}

/** Opens the news report or TV episode edit dialog for a playable guid. */
export function openCataloguePlayableEditDialog(
  dialog: MatDialog,
  kind: EditableCataloguePlayableKind,
  playableId: string
): MatDialogRef<unknown, EditPlayableDialogResponse> {
  const options = { disableClose: true, autoFocus: true, width: '90%' };
  if (kind === CataloguePlayableKind.NewsReport) {
    return dialog.open<EditNewsReportDialogComponent, { reportId: string }, EditPlayableDialogResponse>(
      EditNewsReportDialogComponent,
      { ...options, data: { reportId: playableId } }
    );
  }
  return dialog.open<EditTvShowEpisodeDialogComponent, { episodeId: string }, EditPlayableDialogResponse>(
    EditTvShowEpisodeDialogComponent,
    { ...options, data: { episodeId: playableId } }
  );
}

/** "News report updated" / "TV episode updated" / "No change"; null when the dialog was just closed. */
export function playableEditResultMessage(
  kind: EditableCataloguePlayableKind,
  result: EditPlayableDialogResponse | null | undefined
): string | null {
  if (result?.updated) {
    return kind === CataloguePlayableKind.NewsReport ? 'News report updated' : 'TV episode updated';
  }
  if (result?.noChange) {
    return 'No change';
  }
  return null;
}

/** News report / TV episode page: curator Edit opens the dialog, then a short result snackbar. */
export function editCataloguePlayableFromPage(
  dialog: MatDialog,
  snackBar: { open: (message: string, action?: string, config?: { duration: number }) => unknown },
  kind: EditableCataloguePlayableKind,
  playableId: string
): void {
  openCataloguePlayableEditDialog(dialog, kind, playableId).afterClosed().subscribe((result) => {
    const message = playableEditResultMessage(kind, result);
    if (message) {
      snackBar.open(message, "Ok", { duration: result?.updated ? 10000 : 3000 });
    }
  });
}
