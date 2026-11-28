import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { AmbiguousIdentityPrompt } from '../ambiguous-identity-dialog/ambiguous-identity-dialog.component';
import { CurationSubmitService } from '../curation-submit.service';
import { CreateFilmDialogClose, FilmCreateRequest, FilmCreateResponse } from '../film-create.interface';
import { isFilmExternalIdPaste } from '../film-external-id.util';
import { imdbIdPattern } from '../playable-edit-form.util';
import { promptAmbiguousIdentity } from '../submit-language-identity-prompts';

const MAX_IDENTITY_ROUNDS = 4;

/** The film that already has the identity or name (409), offered so the curator can open it. */
export interface ExistingFilm {
  id: string;
  name: string | null;
}

/**
 * The POST /film body for what the curator typed, or null when there is nothing to send. A `tt…` id is an IMDb
 * title id and digits are a TMDB movie id. A title with no id is looked up (identity prompt). With an id the title
 * only overrides the film's name.
 */
export function buildFilmCreateRequest(idText: string, titleText: string): FilmCreateRequest | null {
  const id = idText.trim().toLowerCase();
  const title = titleText.trim();
  const request: FilmCreateRequest = {};
  if (id.length > 0) {
    if (imdbIdPattern.test(id)) {
      request.imdbId = id;
    } else if (isFilmExternalIdPaste(id)) {
      request.tmdbId = Number(id);
    } else {
      return null;
    }
  }
  if (title.length > 0) {
    request.title = title;
  }
  return Object.keys(request).length > 0 ? request : null;
}

/**
 * Confirms and sends the curator "New film from TMDB/IMDb" command (POST /film, RPP #1413): creates an empty film
 * (no episode, no main video) from an IMDb or TMDB id, or from a title looked up in the identity authorities, so a
 * trailer for a film the catalogue does not have yet can then be attached to it.
 *
 * A title with no id that matches several films opens the same identity candidate picker as Move to film and the
 * answer is re-sent. A film that already has the identity or name (409) is selected so the curator can open it.
 */
@Component({
  selector: 'app-create-film-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule
  ],
  templateUrl: './create-film-dialog.component.html',
  styleUrl: './create-film-dialog.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateFilmDialogComponent {
  private readonly dialogRef = inject<MatDialogRef<CreateFilmDialogComponent, CreateFilmDialogClose>>(MatDialogRef);
  private readonly curationSubmit = inject(CurationSubmitService);
  private readonly identityDialog = inject(MatDialog);

  readonly externalId = new FormControl<string>('', { nonNullable: true });
  readonly title = new FormControl<string>('', { nonNullable: true });
  readonly isSending = signal(false);
  readonly error = signal<string | null>(null);
  /** Set on a 409 that names the film that already has the identity or name. */
  readonly existingFilm = signal<ExistingFilm | null>(null);

  /** The id field is blank, or an IMDb title id (`tt…`) or a TMDB movie id (digits). */
  hasInvalidId(): boolean {
    const id = this.externalId.value.trim();
    return id.length > 0 && !isFilmExternalIdPaste(id.toLowerCase());
  }

  hasInvalidTitle(): boolean {
    return this.title.value.includes('/');
  }

  canSend(): boolean {
    return !this.isSending()
      && !this.hasInvalidId()
      && !this.hasInvalidTitle()
      && buildFilmCreateRequest(this.externalId.value, this.title.value) !== null;
  }

  /** Editing either field withdraws an earlier 409 pick or error. */
  onInput(): void {
    this.error.set(null);
    this.existingFilm.set(null);
  }

  async create(): Promise<void> {
    if (!this.canSend()) {
      return;
    }
    // Guard before body build / POST so a double-click cannot fire two creates.
    this.isSending.set(true);
    this.error.set(null);
    this.existingFilm.set(null);
    const built = buildFilmCreateRequest(this.externalId.value, this.title.value);
    if (!built) {
      this.isSending.set(false);
      return;
    }
    let body = built;
    try {
      for (let round = 0; round < MAX_IDENTITY_ROUNDS; round++) {
        const resp = await firstValueFrom(this.curationSubmit.postFilm(body));
        const outcome = resp.body as FilmCreateResponse | null;
        if (resp.status === 200 && outcome?.cancelled) {
          this.isSending.set(false);
          return;
        }
        if (resp.status === 200 && outcome?.identityDecision) {
          if (!outcome.identityDecision.candidates?.length) {
            this.isSending.set(false);
            this.error.set('No confident identity match. Enter an IMDb or TMDB id instead.');
            return;
          }
          const next = await this.answerIdentity(outcome.identityDecision, body);
          if (!next) {
            this.isSending.set(false);
            return;
          }
          body = next;
          continue;
        }
        // Contract: 202 = created; 200 = identity/cancelled gate only (nothing written).
        // Require filmId + a navigable name (outcome or request title) — never close as success without them.
        if (resp.status === 202) {
          const name = outcome?.name ?? body.title ?? undefined;
          if (!outcome?.filmId || !name) {
            this.isSending.set(false);
            this.error.set('Unexpected response while creating the film.');
            return;
          }
          this.dialogRef.close({
            created: true,
            filmId: outcome.filmId,
            name
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
      this.onError(e as HttpErrorResponse, body);
      console.error(e);
    }
  }

  private onError(err: HttpErrorResponse, sent: FilmCreateRequest): void {
    const outcome = err?.error as FilmCreateResponse | null | undefined;
    if (err?.status === 500 && outcome?.failureIndexing && outcome.filmId) {
      const name = outcome.name ?? sent.title ?? undefined;
      if (!name) {
        this.error.set('Unexpected response while creating the film.');
        return;
      }
      // The film exists; only the search push failed. Do not leave the curator on a create that would now 409.
      this.dialogRef.close({
        created: true,
        failureIndexing: true,
        filmId: outcome.filmId,
        name
      });
      return;
    }
    if (err?.status === 409 && outcome?.filmId) {
      this.existingFilm.set({ id: outcome.filmId, name: outcome.name ?? null });
    }
    this.error.set(createFilmErrorMessage(err));
  }

  /** Closes on the film that already has the identity or name, so the page can open it. */
  openExisting(): void {
    const film = this.existingFilm();
    if (!film?.name) {
      return;
    }
    this.dialogRef.close({ created: false, existing: true, filmId: film.id, name: film.name });
  }

  private async answerIdentity(
    prompt: AmbiguousIdentityPrompt,
    previous: FilmCreateRequest
  ): Promise<FilmCreateRequest | null> {
    const identity = await promptAmbiguousIdentity(this.identityDialog, prompt);
    if (!identity || identity.decision === 'cancel') {
      await firstValueFrom(this.curationSubmit.postFilm({ ...previous, identityDecision: 'cancel' }))
        .catch(() => undefined);
      return null;
    }
    return {
      ...previous,
      identityDecision: identity.decision,
      ...(identity.decision === 'select' ? { selectedIdentityKey: identity.key } : {})
    };
  }

  cancel(): void {
    this.dialogRef.close({ created: false });
  }
}

/** The snackbar after the dialog closes on a film: created, created-but-unindexed, or an existing film opened. */
export function createFilmMessage(result: CreateFilmDialogClose): string {
  if (result.existing) {
    return 'This film already exists. Opened it.';
  }
  const attach = 'To attach a trailer, open the episode, choose Attach as trailer and pick this film.';
  return result.failureIndexing
    ? `Film created, but it is not in search yet. ${attach}`
    : `Film created. ${attach}`;
}

export function createFilmErrorMessage(e: HttpErrorResponse): string {
  const body = e.error as FilmCreateResponse | null | undefined;
  switch (e.status) {
    case 409:
      return body?.filmId
        ? (body.error ?? 'A film with this identity or name already exists.')
        : (body?.error ?? 'The film was just removed. Send again.');
    case 400:
      return body?.error ?? 'The film cannot be created from this id or title.';
    case 404:
      return body?.error ?? 'No film was found for this id or title.';
    default:
      return 'An error occurred creating the film. Sending again is safe: a film that was created answers with its id.';
  }
}
