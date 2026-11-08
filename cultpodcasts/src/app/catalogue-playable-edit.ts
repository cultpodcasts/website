import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { CataloguePlayableKind } from './catalogue-playable-kind.enum';
import { EditFilmDialogComponent } from './edit-film-dialog/edit-film-dialog.component';
import { EditNewsReportDialogComponent } from './edit-news-report-dialog/edit-news-report-dialog.component';
import { EditTvShowEpisodeDialogComponent } from './edit-tv-show-episode-dialog/edit-tv-show-episode-dialog.component';
import { EditPlayableDialogResponse } from './playable-edit.interface';
import { socialRetractFailureMessage } from './social-retract-result';

/** Playable kinds with a curator edit dialog (news report, TV episode, film). */
export type EditableCataloguePlayableKind =
  | CataloguePlayableKind.NewsReport
  | CataloguePlayableKind.TvShowEpisode
  | CataloguePlayableKind.Film;

export function isEditableCataloguePlayableKind(kind: string | null | undefined): kind is EditableCataloguePlayableKind {
  return kind === CataloguePlayableKind.NewsReport
    || kind === CataloguePlayableKind.TvShowEpisode
    || kind === CataloguePlayableKind.Film;
}

/** Opens the news report, TV episode or film edit dialog for a playable guid. */
export function openCataloguePlayableEditDialog(
  dialog: MatDialog,
  kind: EditableCataloguePlayableKind,
  playableId: string,
  highlightDefaultLanguage = false
): MatDialogRef<unknown, EditPlayableDialogResponse> {
  const options = { disableClose: true, autoFocus: true, width: '90%' };
  const highlight = highlightDefaultLanguage ? { highlightDefaultLanguage: true } : {};
  if (kind === CataloguePlayableKind.NewsReport) {
    return dialog.open<EditNewsReportDialogComponent, { reportId: string; highlightDefaultLanguage?: boolean }, EditPlayableDialogResponse>(
      EditNewsReportDialogComponent,
      { ...options, data: { reportId: playableId, ...highlight } }
    );
  }
  if (kind === CataloguePlayableKind.Film) {
    return dialog.open<EditFilmDialogComponent, { filmId: string; highlightDefaultLanguage?: boolean }, EditPlayableDialogResponse>(
      EditFilmDialogComponent,
      { ...options, data: { filmId: playableId, ...highlight } }
    );
  }
  return dialog.open<EditTvShowEpisodeDialogComponent, { episodeId: string; highlightDefaultLanguage?: boolean }, EditPlayableDialogResponse>(
    EditTvShowEpisodeDialogComponent,
    { ...options, data: { episodeId: playableId, ...highlight } }
  );
}

const updatedMessages: Record<EditableCataloguePlayableKind, string> = {
  [CataloguePlayableKind.NewsReport]: 'News report updated',
  [CataloguePlayableKind.TvShowEpisode]: 'TV episode updated',
  [CataloguePlayableKind.Film]: 'Film updated'
};

/** Updated / retract-failure / "No change"; null when the dialog was just closed. */
export function playableEditResultMessage(
  kind: EditableCataloguePlayableKind,
  result: EditPlayableDialogResponse | null | undefined
): string | null {
  if (result?.updated) {
    return socialRetractFailureMessage(result.response) ?? updatedMessages[kind];
  }
  if (result?.noChange) {
    return 'No change';
  }
  return null;
}

/**
 * Review list for a news report, TV episode or film: same `/episodes` route as a podcast episode.
 * `GET /episode/{id}` already returns those kinds by guid.
 */
export function cataloguePlayableReviewListCommands(playableId: string): (string | string[])[] {
  return ['/episodes', JSON.stringify([playableId])];
}

export async function navigateToCataloguePlayableReviewList(
  router: Pick<Router, 'navigate'>,
  playableId: string
): Promise<boolean> {
  return router.navigate(cataloguePlayableReviewListCommands(playableId));
}

type PageEditSnackBar = {
  open: (
    message: string,
    action?: string,
    config?: { duration: number }
  ) => MatSnackBarRef<TextOnlySnackBar> | { onAction: () => { subscribe: (fn: () => void) => unknown } };
};

/** News report / TV episode / film page: curator Edit opens the dialog, then Review on the review list. */
export function editCataloguePlayableFromPage(
  dialog: MatDialog,
  snackBar: PageEditSnackBar,
  router: Pick<Router, 'navigate'>,
  kind: EditableCataloguePlayableKind,
  playableId: string
): void {
  openCataloguePlayableEditDialog(dialog, kind, playableId).afterClosed().subscribe((result) => {
    const message = playableEditResultMessage(kind, result);
    if (!message) {
      return;
    }
    const ref = snackBar.open(message, 'Review', { duration: result?.updated ? 10000 : 3000 });
    ref.onAction().subscribe(() => {
      void navigateToCataloguePlayableReviewList(router, playableId);
    });
  });
}
