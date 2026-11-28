import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
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
import {
  attachTrailerErrorMessage,
  creatableParentName,
  idTargetFromText,
  SuggestionQueryGuard,
  CreateTrailerTarget,
  IdTrailerTarget
} from '../trailer-target';

const MAX_IDENTITY_ROUNDS = 4;

/** The autocomplete option value for 'Create film "<name>"' (a film suggestion is a {@link Suggestion}). */
export interface CreateFilmOption {
  createFilm: true;
}

/** The single 'Create film' option value; the name comes from {@link AttachTrailerDialogComponent.createName}. */
export const CREATE_FILM_OPTION: CreateFilmOption = { createFilm: true };

function isCreateOption(value: unknown): value is CreateFilmOption {
  return !!value && typeof value === 'object' && (value as CreateFilmOption).createFilm === true;
}

/**
 * Confirms and sends the curator "Attach as trailer" command for one podcast episode. The film is picked from the
 * search-suggestions film names (they carry the film id); a film id can be pasted for a film too new for the
 * suggestions corpus. 'Create film "<name>"' attaches to a new film of the typed name (e.g. an unreleased film whose
 * trailer is out first; RPP #1418), after the same identity prompt as Move to film.
 *
 * Hardening (#665, after #664): 'Create film' is offered as soon as a creatable name is typed, as the FIRST
 * autocomplete option (above the film suggestions, so a long list of near matches never pushes it out of view), and
 * is only withdrawn when the suggestions come back with a film of exactly that name. It does not wait on the
 * suggestions corpus, and a failed suggest keeps it, so it never depends on that download. (The #664 report itself
 * was most likely a tab still running a stale service-worker build; see #666.) Typing is read from
 * `filmQuery.valueChanges`, not the template `(input)` event.
 *
 * A pick is announced through the CDK LiveAnnouncer (an always-present live region), as well as shown in the
 * visual selected box: a `role="status"` element inserted at the moment of the pick is not read by every screen reader.
 */
@Component({
  selector: 'app-attach-trailer-dialog',
  imports: [
    MatAutocompleteModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
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
  /** The film picked: a suggestion (id + name), a pasted id, or 'Create film' (a name, no id; RPP #1418). */
  readonly selected = signal<IdTrailerTarget | CreateTrailerTarget | null>(null);
  readonly isSending = signal(false);
  readonly error = signal<string | null>(null);
  /** The typed name to offer as 'Create film "…"': no film suggestion has it, it is not an id, and has no '/'. */
  readonly createName = signal<string | null>(null);
  readonly createOption = CREATE_FILM_OPTION;
  private readonly identityDialog = inject(MatDialog);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly queries = new SuggestionQueryGuard();

  constructor() {
    this.title = new FormControl<string>(this.data.episodeTitle ?? '', { nonNullable: true });
    this.suggestions.preload();
    // Picking an option writes the option value (an object) into the control; only typed text is a query.
    this.filmQuery.valueChanges.pipe(takeUntilDestroyed()).subscribe(value => {
      if (typeof value === 'string') {
        void this.onFilmQuery(value);
      }
    });
  }

  /**
   * Typing replaces any earlier pick; a pasted film id is a pick on its own. 'Create film' is offered at once for a
   * creatable name and withdrawn only if the suggestions have a film of exactly that name.
   */
  async onFilmQuery(value: string): Promise<void> {
    const text = value.trim();
    this.error.set(null);
    this.selected.set(idTargetFromText(text));
    const name = creatableParentName(text);
    this.createName.set(name);
    const version = this.queries.begin();
    if (!name) {
      this.films.set([]);
      return;
    }
    let found: Suggestion[] = [];
    try {
      found = await this.suggestions.suggest(text, 10, 'film');
    } catch (e) {
      console.error('Film suggestions failed; Create film stays available.', e);
    }
    if (this.queries.isLatest(version)) {
      const films = found.filter(film => !!film.itemId);
      this.films.set(films);
      const exact = films.some(film => film.value.trim().toLowerCase() === name.toLowerCase());
      this.createName.set(exact ? null : name);
    }
  }

  /** Picks 'Create film "<name>"': the attach then creates the film (or joins one the suggestions have not caught up with). */
  chooseCreate(): void {
    const name = this.createName();
    if (!name || this.isSending()) {
      return;
    }
    this.error.set(null);
    this.selected.set({ kind: 'create', name });
    void this.announcer.announce(createFilmAnnouncement(name), 'polite');
  }

  onFilmSelected(event: MatAutocompleteSelectedEvent): void {
    if (isCreateOption(event.option.value)) {
      const name = this.createName();
      this.chooseCreate();
      this.filmQuery.setValue(name ?? '', { emitEvent: false });
      return;
    }
    const film = event.option.value as Suggestion;
    if (!film?.itemId) {
      return;
    }
    this.selected.set({ kind: 'id', id: film.itemId, name: film.value });
    this.createName.set(null);
    this.filmQuery.setValue(film.label, { emitEvent: false });
    void this.announcer.announce(pickedFilmAnnouncement(film.label), 'polite');
  }

  /** Shows the label in the input after a pick (the option value is the suggestion). */
  displayFilm = (value: Suggestion | CreateFilmOption | string | null): string => {
    if (typeof value === 'string') {
      return value;
    }
    if (isCreateOption(value)) {
      return this.createName() ?? '';
    }
    return value?.label ?? '';
  };

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
    if (film.kind === 'create') {
      void this.createAndAttach(film.name);
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
            name: body?.name ?? film.name
          });
        },
        error: (e: HttpErrorResponse) => {
          this.isSending.set(false);
          this.error.set(attachTrailerErrorMessage(e, 'film'));
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
            name: outcome?.name ?? name,
            ...(outcome?.filmCreated ? { filmCreated: true } : {})
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
      this.error.set(attachTrailerErrorMessage(e as HttpErrorResponse, 'film'));
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

/** Screen-reader text when 'Create film "<name>"' is picked. */
export function createFilmAnnouncement(name: string): string {
  return `New film picked: ${name}. Attach as trailer creates it.`;
}

/** Screen-reader text when an existing film is picked. */
export function pickedFilmAnnouncement(label: string): string {
  return `Film picked: ${label}.`;
}

/** The snackbar after an attach: a created film is new, with no release date or main video until Edit film adds them. */
export function attachedAsTrailerMessage(result: AttachTrailerDialogClose): string {
  return result.filmCreated
    ? 'Film created and episode attached as its trailer. Add its release date and video in Edit film.'
    : 'Attached as trailer';
}
