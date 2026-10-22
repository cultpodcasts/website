import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { map, switchMap, throwError } from 'rxjs';
import { PlayableEditFieldsComponent } from '../playable-edit-fields/playable-edit-fields.component';
import { PlayableEditDialogBase } from '../playable-edit-dialog.base';
import { filmChanges, PlayableEditFormValue } from '../playable-edit-form.util';
import { FilmChangeRequest, FilmDto } from '../playable-edit.interface';

export interface EditFilmDialogData {
  filmId: string;
}

/**
 * Curator edit of a film (GET/PATCH `film/{id}`), laid out like the news report / TV episode dialogs: Details
 * (read-only name, publisher, description), Flags, Meta, Guests, Identity (IMDb id, TMDB id; links built from the ids), Links
 * (YouTube, BBC iPlayer, Internet Archive, …) and Trailers (rename, reorder, remove). The name is not editable
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
   * The `trailers` patch is a keep-list: a trailer it leaves out is removed. A trailer attached after this dialog
   * loaded is not in the list, and its episode is already deleted, so sending a stale list would lose it. Before a
   * trailers change, re-read the film and refuse (as a 400-style message) when it has a trailer this dialog never saw.
   */
  protected patch(id: string, changes: FilmChangeRequest) {
    if (changes.trailers === undefined) {
      return this.curation.patchFilm(id, changes);
    }
    const known = new Set((this.original?.trailers ?? []).map(trailer => trailer.id));
    return this.curation.getFilm(id).pipe(
      switchMap(latest => {
        const added = (latest.trailers ?? []).filter(trailer => !known.has(trailer.id));
        return added.length === 0
          ? this.curation.patchFilm(id, changes)
          : throwError(() => new HttpErrorResponse({
            status: 400,
            statusText: 'Trailers changed',
            error: { message: staleTrailersMessage(added.length) }
          }));
      })
    );
  }

  protected changes(original: FilmDto, value: PlayableEditFormValue, pendingUnBluesky: boolean): FilmChangeRequest {
    return filmChanges(original, value, pendingUnBluesky);
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
