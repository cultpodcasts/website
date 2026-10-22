import { ChangeDetectionStrategy, Component, Inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CurationSubmitService } from '../curation-submit.service';
import {
  EpisodeFilmMoveResponse,
  MoveEpisodeToFilmDialogClose,
  MoveEpisodeToFilmDialogData
} from '../episode-film-move.interface';

/** Indexer look-back (indexer__ReleasedDaysAgo = 2) plus a day for the YouTube publishing delay. */
export const RECENT_RELEASE_DAYS = 3;

export function releasedWithinDays(release: Date | string | null | undefined, days: number, now: Date): boolean {
  if (!release) {
    return false;
  }
  const released = new Date(release).getTime();
  if (Number.isNaN(released)) {
    return false;
  }
  return now.getTime() - released < days * 24 * 60 * 60 * 1000;
}

/** Confirms and sends the curator "Move to film" command for one podcast episode. */
@Component({
  selector: 'app-move-episode-to-film-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule
  ],
  templateUrl: './move-episode-to-film-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './move-episode-to-film-dialog.component.sass'
})
export class MoveEpisodeToFilmDialogComponent {
  readonly title: FormControl<string>;
  readonly isSending = signal(false);
  readonly error = signal<string | null>(null);

  constructor(
    private dialogRef: MatDialogRef<MoveEpisodeToFilmDialogComponent, MoveEpisodeToFilmDialogClose>,
    @Inject(MAT_DIALOG_DATA) public data: MoveEpisodeToFilmDialogData,
    private curationSubmit: CurationSubmitService) {
    this.title = new FormControl<string>(data.episodeTitle ?? '', { nonNullable: true });
  }

  /** The title to send: null keeps the episode title on the server. */
  requestTitle(): string | null {
    const value = this.title.value.trim();
    return value.length === 0 || value === (this.data.episodeTitle ?? '').trim() ? null : value;
  }

  /** Released inside the Indexer's look-back, so the next index may re-add it to the podcast (RPP #1068). */
  isRecentlyReleased(): boolean {
    return releasedWithinDays(this.data.release, RECENT_RELEASE_DAYS, new Date());
  }

  hasInvalidTitle(): boolean {
    return this.title.value.includes('/');
  }

  move() {
    if (this.isSending() || this.hasInvalidTitle()) {
      return;
    }
    this.isSending.set(true);
    this.error.set(null);
    this.curationSubmit.postEpisodeToFilm(this.data.podcastId, this.data.episodeId, this.requestTitle()).subscribe({
      next: resp => {
        const body = resp.body as EpisodeFilmMoveResponse | null;
        this.dialogRef.close({
          moved: true,
          filmId: body?.filmId ?? this.data.episodeId,
          name: body?.name ?? (this.requestTitle() ?? this.data.episodeTitle)
        });
      },
      error: (e: HttpErrorResponse) => {
        this.isSending.set(false);
        this.error.set(moveErrorMessage(e));
        console.error(e);
      }
    });
  }

  cancel() {
    this.dialogRef.close({ moved: false });
  }
}

export function moveErrorMessage(e: HttpErrorResponse): string {
  const body = e.error as { error?: string } | null | undefined;
  switch (e.status) {
    case 409:
      return 'A film with this name already exists. Choose a different title.';
    case 400:
      return body?.error ?? 'The episode cannot be moved to a film.';
    case 404:
      return 'The episode was not found. It may already have been moved.';
    default:
      return 'An error occurred moving the episode. Sending again resumes an interrupted move.';
  }
}
