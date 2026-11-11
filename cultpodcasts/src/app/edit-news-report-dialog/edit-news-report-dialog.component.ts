import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { filmPageCommands, tvShowEpisodePageCommands } from '../catalogue-links';
import { CurationSubmitService } from '../curation-submit.service';
import { MoveEpisodeToFilmDialogClose, MoveEpisodeToFilmDialogData } from '../episode-film-move.interface';
import { MoveEpisodeToTvShowDialogClose, MoveEpisodeToTvShowDialogData } from '../episode-tv-show-move.interface';
import { MoveEpisodeToFilmDialogComponent } from '../move-episode-to-film-dialog/move-episode-to-film-dialog.component';
import { MoveEpisodeToTvShowDialogComponent } from '../move-episode-to-tv-show-dialog/move-episode-to-tv-show-dialog.component';
import { PlayableEditFieldsComponent } from '../playable-edit-fields/playable-edit-fields.component';
import { PlayableEditDialogBase } from '../playable-edit-dialog.base';
import { PlayableEditFormValue, playableFieldsChanges } from '../playable-edit-form.util';
import { NewsReportChangeRequest, NewsReportDto } from '../playable-edit.interface';

export interface EditNewsReportDialogData {
  reportId: string;
  highlightDefaultLanguage?: boolean;
}

type MoveSnackBar = Pick<MatSnackBar, 'open'>;

/**
 * After a news report move (RPP #1368): the moved snackbar, or, when the move left the news organisation with
 * no reports, a snackbar offering to retire it (PATCH `newsorganisation/{id}` `removed: true`, curate).
 * Nothing is retired unless the curator presses Retire.
 */
export function announceNewsReportMove(
  snackBar: MoveSnackBar,
  curation: Pick<CurationSubmitService, 'patchCatalogueParent'>,
  movedMessage: string,
  emptiedNewsOrganisationId: string | null | undefined,
  newsOrganisationName: string
): void {
  if (!emptiedNewsOrganisationId) {
    snackBar.open(movedMessage, 'Ok', { duration: 10000 });
    return;
  }
  const named = newsOrganisationName.trim();
  const outlet = named || 'The news organisation';
  const ref = snackBar.open(`${movedMessage}. ${outlet} has no reports left.`, 'Retire', { duration: 20000 });
  ref.onAction().subscribe(() => {
    curation.patchCatalogueParent('news', emptiedNewsOrganisationId, { removed: true }).subscribe({
      next: () => snackBar.open(`${outlet} retired`, 'Ok', { duration: 5000 }),
      error: (e: unknown) => {
        console.error(e);
        const gone = e instanceof HttpErrorResponse && e.status === 404;
        snackBar.open(gone
          ? `${outlet} was already removed or no longer exists`
          : `Could not retire ${named || 'the news organisation'}`, 'Ok', { duration: 10000 });
      }
    });
  });
}

/** Curator edit of a news report (GET/PATCH `newsreport/{id}`), laid out like the podcast Edit Episode dialog. */
@Component({
  selector: 'app-edit-news-report-dialog',
  imports: [MatDialogModule, MatButtonModule, MatProgressSpinnerModule, ReactiveFormsModule, PlayableEditFieldsComponent],
  templateUrl: './edit-news-report-dialog.component.html',
  styleUrl: './edit-news-report-dialog.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditNewsReportDialogComponent extends PlayableEditDialogBase<NewsReportDto, NewsReportChangeRequest> {
  readonly data = inject<EditNewsReportDialogData>(MAT_DIALOG_DATA);
  protected readonly hub = 'news' as const;
  protected readonly variant = 'news' as const;
  /** Move to TV show / film (RPP #1368), behind the same switch as the episode editor's moves. */
  protected readonly canMove = environment.catalogueParentCuration.edit;
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  protected playableId(): string {
    return this.data.reportId;
  }

  protected load(id: string) {
    return this.curation.getNewsReport(id);
  }

  protected patch(id: string, changes: NewsReportChangeRequest) {
    return this.curation.patchNewsReport(id, changes);
  }

  protected changes(original: NewsReportDto, value: PlayableEditFormValue): NewsReportChangeRequest {
    return playableFieldsChanges(original, value);
  }

  protected parentOf(dto: NewsReportDto) {
    return { id: dto.newsOrganisationId, name: dto.newsOrganisationName ?? '' };
  }

  moveToTvShow(): void {
    const report = this.original;
    if (!report || this.isSaving()) {
      return;
    }
    const data: MoveEpisodeToTvShowDialogData = {
      podcastId: report.newsOrganisationId,
      podcastName: this.parentName(),
      episodeId: report.id,
      episodeTitle: report.title,
      release: report.release,
      hasUnsavedChanges: this.form()?.dirty ?? false,
      newsReportId: report.id
    };
    this.dialog.open<MoveEpisodeToTvShowDialogComponent, MoveEpisodeToTvShowDialogData, MoveEpisodeToTvShowDialogClose>(
      MoveEpisodeToTvShowDialogComponent, { data, disableClose: true, autoFocus: true, width: '90%', maxWidth: '600px' })
      .afterClosed()
      .subscribe(result => {
        if (!result?.moved) {
          return;
        }
        this.dialogRef.close({ moved: true, parentName: this.parentName() });
        announceNewsReportMove(this.snackBar, this.curation,
          result.createdShow ? 'Moved to new TV show' : 'Moved to TV show',
          result.emptiedNewsOrganisationId, this.parentName());
        if (result.tvShowName && result.episodeId) {
          void this.router.navigate(tvShowEpisodePageCommands(result.tvShowName, result.episodeId));
        }
      });
  }

  moveToFilm(): void {
    const report = this.original;
    if (!report || this.isSaving()) {
      return;
    }
    const data: MoveEpisodeToFilmDialogData = {
      podcastId: report.newsOrganisationId,
      episodeId: report.id,
      episodeTitle: report.title,
      release: report.release,
      hasUnsavedChanges: this.form()?.dirty ?? false,
      newsReportId: report.id
    };
    this.dialog.open<MoveEpisodeToFilmDialogComponent, MoveEpisodeToFilmDialogData, MoveEpisodeToFilmDialogClose>(
      MoveEpisodeToFilmDialogComponent, { data, disableClose: true, autoFocus: true, width: '90%', maxWidth: '600px' })
      .afterClosed()
      .subscribe(result => {
        if (!result?.moved || !result.filmId || !result.name) {
          return;
        }
        this.dialogRef.close({ moved: true, parentName: this.parentName() });
        announceNewsReportMove(this.snackBar, this.curation, 'Moved to film', result.emptiedNewsOrganisationId, this.parentName());
        void this.router.navigate(filmPageCommands(result.name, result.filmId));
      });
  }
}
