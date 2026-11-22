import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, map, switchMap, throwError } from 'rxjs';
import { PlayableEditFieldsComponent } from '../playable-edit-fields/playable-edit-fields.component';
import { PlayableEditDialogBase } from '../playable-edit-dialog.base';
import { filmChanges, PlayableEditFormValue } from '../playable-edit-form.util';
import { FilmChangeRequest, FilmDto } from '../playable-edit.interface';

export interface EditFilmDialogData {
  filmId: string;
  highlightDefaultLanguage?: boolean;
}

/**
 * Curator edit of a film (GET/PATCH `film/{id}`), laid out like the news report / TV episode dialogs: Details
 * (read-only name, publisher, description), Flags, Urls (YouTube, BBC iPlayer, Internet Archive, …), Meta, Images,
 * Trailers (rename, reorder, remove), Guests and Identity (IMDb URL, IMDb id, TMDB id). The name is not editable
 * here: the film PATCH has no title, renames go through the admin rename screen. A film has no parent, so its
 * own default subject is hoisted, and `parentName` on close is the film name (for the Review link).
 */
@Component({
  selector: 'app-edit-film-dialog',
  imports: [MatDialogModule, MatButtonModule, MatProgressSpinnerModule, ReactiveFormsModule, PlayableEditFieldsComponent],
  templateUrl: './edit-film-dialog.component.html',
  styleUrl: './edit-film-dialog.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditFilmDialogComponent extends PlayableEditDialogBase<FilmDto, FilmChangeRequest> {
  readonly data = inject<EditFilmDialogData>(MAT_DIALOG_DATA);
  protected readonly hub = null;
  protected readonly variant = 'film' as const;

  protected playableId(): string {
    return this.data.filmId;
  }

  protected load(id: string) {
    // The GET has `name`, not `title`: the shared form shows it (disabled) as the title.
    return this.curation.getFilm(id).pipe(map((dto): FilmDto => ({ ...dto, title: dto.name ?? '' })));
  }

  /**
   * Trailer and additional-YouTube patches are keep-lists: an entry left out is removed. An upload attached
   * after this dialog loaded is not in the list, so sending a stale list would lose it. Before those changes,
   * re-read the film and refuse when it has an entry this dialog never saw.
   */
  protected patch(id: string, changes: FilmChangeRequest) {
    const send = () => this.curation.patchFilm(id, changes).pipe(
      catchError(error => error instanceof HttpErrorResponse && error.status === 409
        ? throwError(() => new HttpErrorResponse({
          status: 400,
          statusText: 'Conflict',
          error: { message: staleKeepListMessage(error) }
        }))
        : throwError(() => error))
    );
    const checkingTrailers = changes.trailers !== undefined;
    const checkingYouTube = changes.additionalYouTube !== undefined;
    if (!checkingTrailers && !checkingYouTube) {
      return send();
    }
    const knownTrailers = new Set((this.original?.trailers ?? []).map(trailer => trailer.id));
    const knownYouTube = new Set((this.original?.additionalYouTube ?? []).map(item => item.youTubeId));
    return this.curation.getFilm(id).pipe(
      switchMap(latest => {
        if (checkingTrailers) {
          const added = (latest.trailers ?? []).filter(trailer => !knownTrailers.has(trailer.id));
          if (added.length > 0) {
            return throwError(() => new HttpErrorResponse({
              status: 400,
              statusText: 'Trailers changed',
              error: { message: staleTrailersMessage(added.length) }
            }));
          }
        }
        if (checkingYouTube) {
          const added = (latest.additionalYouTube ?? []).filter(item => !knownYouTube.has(item.youTubeId));
          if (added.length > 0) {
            return throwError(() => new HttpErrorResponse({
              status: 400,
              statusText: 'YouTube uploads changed',
              error: { message: staleYouTubeAlternatesMessage(added.length) }
            }));
          }
        }
        return send();
      })
    );
  }

  protected changes(original: FilmDto, value: PlayableEditFormValue): FilmChangeRequest {
    return filmChanges(original, value);
  }

  protected parentOf(dto: FilmDto) {
    return { id: '', name: dto.name ?? '' };
  }

  protected override ownDefaultSubject(dto: FilmDto): string | null {
    return dto.defaultSubject ?? null;
  }
}

export function staleTrailersMessage(added: number): string {
  return `${added === 1 ? 'A trailer was' : `${added} trailers were`} attached to this film after the editor opened. ` +
    'Close and reopen the film to edit its trailers.';
}

export function staleYouTubeAlternatesMessage(added: number): string {
  return `${added === 1 ? 'An additional YouTube upload was' : `${added} additional YouTube uploads were`} added to this film after the editor opened. ` +
    'Close and reopen the film to edit them.';
}

export function staleKeepListMessage(error: HttpErrorResponse): string {
  const youTubeIds = error.error?.unexpectedAdditionalYouTubeIds;
  if (Array.isArray(youTubeIds) && youTubeIds.length > 0) {
    return staleYouTubeAlternatesMessage(youTubeIds.length);
  }
  const trailerIds = error.error?.unexpectedTrailerIds;
  if (Array.isArray(trailerIds) && trailerIds.length > 0) {
    return staleTrailersMessage(trailerIds.length);
  }
  const message = typeof error.error?.message === 'string' ? error.error.message.trim() : '';
  if (message) {
    return message;
  }
  return staleTrailersMessage(1);
}
