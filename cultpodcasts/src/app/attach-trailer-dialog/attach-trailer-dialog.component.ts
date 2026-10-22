import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CurationSubmitService } from '../curation-submit.service';
import {
  AttachTrailerDialogClose,
  AttachTrailerDialogData,
  EpisodeTrailerAttachResponse
} from '../episode-trailer-attach.interface';
import { Suggestion } from '../search-suggestions.interface';
import { SearchSuggestionsService } from '../search-suggestions.service';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A film picked in the dialog: from the suggestions (name + id) or a pasted film id (no name yet). */
export interface AttachTrailerFilm {
  id: string;
  name: string | null;
}

/**
 * Confirms and sends the curator "Attach as trailer" command for one podcast episode. The film is picked from the
 * search-suggestions film names (they carry the film id); a film id can be pasted for a film too new for the
 * suggestions corpus.
 */
@Component({
  selector: 'app-attach-trailer-dialog',
  imports: [
    MatAutocompleteModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule
  ],
  templateUrl: './attach-trailer-dialog.component.html',
  styleUrl: './attach-trailer-dialog.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttachTrailerDialogComponent {
  private readonly dialogRef = inject<MatDialogRef<AttachTrailerDialogComponent, AttachTrailerDialogClose>>(MatDialogRef);
  private readonly curationSubmit = inject(CurationSubmitService);
  private readonly suggestions = inject(SearchSuggestionsService);
  readonly data = inject<AttachTrailerDialogData>(MAT_DIALOG_DATA);

  readonly filmQuery = new FormControl<string>('', { nonNullable: true });
  readonly title: FormControl<string>;
  readonly films = signal<Suggestion[]>([]);
  readonly selected = signal<AttachTrailerFilm | null>(null);
  readonly isSending = signal(false);
  readonly error = signal<string | null>(null);
  private queryVersion = 0;

  constructor() {
    this.title = new FormControl<string>(this.data.episodeTitle ?? '', { nonNullable: true });
    this.suggestions.preload();
  }

  /** Typing replaces any earlier pick; a pasted film id is a pick on its own. */
  async onFilmQuery(value: string): Promise<void> {
    const text = value.trim();
    this.error.set(null);
    this.selected.set(GUID.test(text) ? { id: text.toLowerCase(), name: null } : null);
    const version = ++this.queryVersion;
    const found = text.length < 2 || GUID.test(text) ? [] : await this.suggestions.suggest(text, 10, 'film');
    if (version === this.queryVersion) {
      this.films.set(found.filter(film => !!film.itemId));
    }
  }

  onFilmSelected(event: MatAutocompleteSelectedEvent): void {
    const film = event.option.value as Suggestion;
    if (!film?.itemId) {
      return;
    }
    this.selected.set({ id: film.itemId, name: film.value });
    this.filmQuery.setValue(film.label, { emitEvent: false });
  }

  /** Shows the label in the input after a pick (the option value is the suggestion). */
  displayFilm(value: Suggestion | string | null): string {
    return typeof value === 'string' ? value : value?.label ?? '';
  }

  /** The title to send: null keeps the episode title on the server. */
  requestTitle(): string | null {
    const value = this.title.value.trim();
    return value.length === 0 || value === (this.data.episodeTitle ?? '').trim() ? null : value;
  }

  attach(): void {
    const film = this.selected();
    if (this.isSending() || !film) {
      return;
    }
    this.isSending.set(true);
    this.error.set(null);
    this.curationSubmit.postEpisodeAsTrailer(this.data.podcastId, this.data.episodeId, film.id, this.requestTitle())
      .subscribe({
        next: resp => {
          const body = resp.body as EpisodeTrailerAttachResponse | null;
          this.dialogRef.close({
            attached: true,
            filmId: body?.filmId ?? film.id,
            name: body?.name ?? film.name ?? undefined
          });
        },
        error: (e: HttpErrorResponse) => {
          this.isSending.set(false);
          this.error.set(attachErrorMessage(e));
          console.error(e);
        }
      });
  }

  cancel(): void {
    this.dialogRef.close({ attached: false });
  }
}

export function attachErrorMessage(e: HttpErrorResponse): string {
  const body = e.error as { error?: string } | null | undefined;
  switch (e.status) {
    case 400:
      return body?.error ?? 'The episode cannot be attached as a trailer.';
    case 404:
      return body?.error ?? 'The episode or film was not found. The episode may already be a trailer.';
    default:
      return 'An error occurred attaching the trailer. Sending again resumes an interrupted attach.';
  }
}
