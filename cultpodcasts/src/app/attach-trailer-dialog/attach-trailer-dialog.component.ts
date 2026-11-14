import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { AmbiguousIdentityPrompt } from '../ambiguous-identity-dialog/ambiguous-identity-dialog.component';
import { CurationSubmitService } from '../curation-submit.service';
import {
  AttachTrailerDialogClose,
  AttachTrailerDialogData,
  EpisodeTrailerAttachRequest,
  EpisodeTrailerAttachResponse
} from '../episode-trailer-attach.interface';
import { Suggestion } from '../search-suggestions.interface';
import { SearchSuggestionsService } from '../search-suggestions.service';
import { promptAmbiguousIdentity } from '../submit-language-identity-prompts';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_IDENTITY_ROUNDS = 4;

/**
 * A film picked in the dialog: from the suggestions (name + id), a pasted film id (no name yet), or a film to create
 * by name (`create`, no id): the server attaches to the film with that name, creating it when none has it (RPP #1418).
 */
export interface AttachTrailerFilm {
  id: string | null;
  name: string | null;
  create?: boolean;
}

/**
 * Confirms and sends the curator "Attach as trailer" command for one podcast episode. The film is picked from the
 * search-suggestions film names (they carry the film id); a film id can be pasted for a film too new for the
 * suggestions corpus. When no suggested film has the typed name, 'Create film "<name>"' attaches to a new film of that
 * name (e.g. an unreleased film whose trailer is out first; RPP #1418), after the same identity prompt as Move to film.
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
  /** The typed name to offer as 'Create film "…"': no film suggestion has it, it is not an id, and has no '/'. */
  readonly createName = signal<string | null>(null);
  private readonly identityDialog = inject(MatDialog);
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
    this.createName.set(null);
    const version = ++this.queryVersion;
    const found = text.length < 2 || GUID.test(text) ? [] : await this.suggestions.suggest(text, 10, 'film');
    if (version === this.queryVersion) {
      const films = found.filter(film => !!film.itemId);
      this.films.set(films);
      const exact = films.some(film => film.value.trim().toLowerCase() === text.toLowerCase());
      this.createName.set(text.length >= 2 && !GUID.test(text) && !text.includes('/') && !exact ? text : null);
    }
  }

  /** Picks 'Create film "<name>"': the attach then creates the film (or joins one the suggestions have not caught up with). */
  chooseCreate(): void {
    const name = this.createName();
    if (!name || this.isSending()) {
      return;
    }
    this.error.set(null);
    this.selected.set({ id: null, name, create: true });
  }

  onFilmSelected(event: MatAutocompleteSelectedEvent): void {
    const film = event.option.value as Suggestion;
    if (!film?.itemId) {
      return;
    }
    this.selected.set({ id: film.itemId, name: film.value });
    this.createName.set(null);
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
    if (film.create || !film.id) {
      void this.createAndAttach(film.name ?? '');
      return;
    }
    const filmId = film.id;
    this.isSending.set(true);
    this.error.set(null);
    this.curationSubmit.postEpisodeAsTrailer(this.data.podcastId, this.data.episodeId, filmId, this.requestTitle())
      .subscribe({
        next: resp => {
          const body = resp.body as EpisodeTrailerAttachResponse | null;
          this.dialogRef.close({
            attached: true,
            filmId: body?.filmId ?? filmId,
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

  /**
   * Attaches to the film named `filmName`, creating it when no film has the name. An ambiguous
   * IMDb/TMDB match opens the same identity picker as Move to film and re-sends the curator's answer.
   */
  async createAndAttach(filmName: string): Promise<void> {
    const name = filmName.trim();
    if (this.isSending() || name.length === 0) {
      return;
    }
    this.isSending.set(true);
    this.error.set(null);
    const title = this.requestTitle();
    let body: EpisodeTrailerAttachRequest = { createFilm: true, filmName: name, ...(title ? { title } : {}) };
    try {
      for (let round = 0; round < MAX_IDENTITY_ROUNDS; round++) {
        const resp = await firstValueFrom(
          this.curationSubmit.postEpisodeAsTrailerCreatingFilm(this.data.podcastId, this.data.episodeId, body));
        const outcome = resp.body as EpisodeTrailerAttachResponse | null;
        if (resp.status === 200 && outcome?.cancelled) {
          this.isSending.set(false);
          return;
        }
        if (resp.status === 200 && outcome?.identityDecision) {
          const next = outcome.identityDecision.candidates?.length
            ? await this.answerIdentity(outcome.identityDecision, body)
            : null;
          if (!next) {
            this.isSending.set(false);
            return;
          }
          body = next;
          continue;
        }
        if (resp.status === 202) {
          this.dialogRef.close({
            attached: true,
            filmId: outcome?.filmId ?? undefined,
            name: outcome?.name ?? name
          });
          return;
        }
        this.isSending.set(false);
        this.error.set('Unexpected response while creating the film.');
        return;
      }
      this.isSending.set(false);
      this.error.set('Identity lookup stopped after too many prompts.');
    } catch (e) {
      this.isSending.set(false);
      this.error.set(attachErrorMessage(e as HttpErrorResponse));
      console.error(e);
    }
  }

  private async answerIdentity(
    prompt: AmbiguousIdentityPrompt,
    previous: EpisodeTrailerAttachRequest
  ): Promise<EpisodeTrailerAttachRequest | null> {
    const identity = await promptAmbiguousIdentity(this.identityDialog, prompt);
    if (!identity || identity.decision === 'cancel') {
      return null;
    }
    return {
      ...previous,
      identityDecision: identity.decision,
      ...(identity.decision === 'select' ? { selectedIdentityKey: identity.key } : {})
    };
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
    case 409:
      return body?.error ?? 'This episode is already a trailer of another film.';
    default:
      return 'An error occurred attaching the trailer. Sending again resumes an interrupted attach.';
  }
}
