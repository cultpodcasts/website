import { ChangeDetectionStrategy, Component, DestroyRef, Inject, Injector, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { AmbiguousIdentityPrompt } from '../ambiguous-identity-dialog/ambiguous-identity-dialog.component';
import { CurationSubmitService } from '../curation-submit.service';
import {
  EpisodeFilmMoveRequest,
  EpisodeFilmMoveResponse,
  MoveEpisodeToFilmDialogClose,
  MoveEpisodeToFilmDialogData
} from '../episode-film-move.interface';
import { Suggestion } from '../search-suggestions.interface';
import { SearchSuggestionsService } from '../search-suggestions.service';
import { promptAmbiguousIdentity } from '../submit-language-identity-prompts';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** New film (the default) or merge into an existing film (RPP #1522, podcast episodes only). */
export type MoveToFilmMode = 'new' | 'existing';

/** The existing film picked from the suggestions (id + name), or a pasted film id (no name yet). */
export interface ExistingFilmPick {
  id: string;
  name: string | null;
}

/** Indexer look-back (indexer__ReleasedDaysAgo = 2) plus a day for the YouTube publishing delay. */
export const RECENT_RELEASE_DAYS = 3;

const MAX_IDENTITY_ROUNDS = 4;

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

/**
 * Confirms and sends the curator "Move to film" command for one podcast episode, or for one news report when
 * `newsReportId` is set (RPP #1368: same body, identity prompt and outcome, POST /newsreport/{id}/film).
 *
 * For a podcast episode the curator can instead pick **Existing film** (RPP #1522): the episode is another copy of a
 * film already in the catalogue, so it is merged into that film (picked from the film suggestions, or a pasted film
 * id) and the body is `{ filmId }`. A new-film move whose name clashes with an existing film switches to Existing film
 * with that film picked, so the curator can merge into it in one more click.
 */
@Component({
  selector: 'app-move-episode-to-film-dialog',
  imports: [
    MatAutocompleteModule,
    MatButtonToggleModule,
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
  private readonly identityDialog = inject(MatDialog);
  /** What moves, and what it leaves: a podcast episode, or a news report (RPP #1368). */
  readonly item: string;
  readonly source: string;
  /** Existing film is offered for podcast episodes only. */
  readonly canMergeIntoExisting: boolean;
  readonly mode = signal<MoveToFilmMode>('new');
  readonly filmQuery = new FormControl<string>('', { nonNullable: true });
  readonly films = signal<Suggestion[]>([]);
  readonly existingFilm = signal<ExistingFilmPick | null>(null);
  private readonly injector = inject(Injector);
  private suggestionsService: SearchSuggestionsService | null = null;
  private queryVersion = 0;

  constructor(
    private dialogRef: MatDialogRef<MoveEpisodeToFilmDialogComponent, MoveEpisodeToFilmDialogClose>,
    @Inject(MAT_DIALOG_DATA) public data: MoveEpisodeToFilmDialogData,
    private curationSubmit: CurationSubmitService) {
    this.title = new FormControl<string>(data.episodeTitle ?? '', { nonNullable: true });
    this.item = data.newsReportId ? 'news report' : 'episode';
    this.source = data.newsReportId ? 'news organisation' : 'podcast';
    this.canMergeIntoExisting = !data.newsReportId;
    // Picking an option writes the suggestion (an object) into the control; only typed text is a query.
    this.filmQuery.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(value => {
      if (typeof value === 'string') {
        void this.onFilmQuery(value);
      }
    });
  }

  /** Resolved on first use, so the new-film path never needs the suggestions service. */
  private get suggestions(): SearchSuggestionsService {
    this.suggestionsService ??= this.injector.get(SearchSuggestionsService);
    return this.suggestionsService;
  }

  setMode(mode: MoveToFilmMode): void {
    if (this.isSending() || (mode === 'existing' && !this.canMergeIntoExisting)) {
      return;
    }
    this.error.set(null);
    this.mode.set(mode);
    if (mode === 'existing') {
      this.suggestions.preload();
    }
  }

  /** Typing replaces any earlier pick; a pasted film id is a pick on its own. */
  async onFilmQuery(value: string): Promise<void> {
    const text = value.trim();
    this.error.set(null);
    this.existingFilm.set(GUID.test(text) ? { id: text.toLowerCase(), name: null } : null);
    const version = ++this.queryVersion;
    if (text.length < 2 || GUID.test(text)) {
      this.films.set([]);
      return;
    }
    let found: Suggestion[] = [];
    try {
      found = await this.suggestions.suggest(text, 10, 'film');
    } catch (e) {
      console.error('Film suggestions failed; a film id can still be pasted.', e);
    }
    if (version === this.queryVersion) {
      this.films.set(found.filter(film => !!film.itemId));
    }
  }

  onFilmSelected(event: MatAutocompleteSelectedEvent): void {
    const film = event.option.value as Suggestion;
    if (!film?.itemId) {
      return;
    }
    this.existingFilm.set({ id: film.itemId, name: film.value });
    this.filmQuery.setValue(film.label, { emitEvent: false });
  }

  /** Shows the label in the input after a pick (the option value is the suggestion). */
  displayFilm = (value: Suggestion | string | null): string =>
    typeof value === 'string' ? value : value?.label ?? '';

  canSend(): boolean {
    if (this.isSending()) {
      return false;
    }
    return this.mode() === 'existing' ? !!this.existingFilm() : !this.hasInvalidTitle();
  }

  private send(body: EpisodeFilmMoveRequest) {
    return this.data.newsReportId
      ? this.curationSubmit.postNewsReportToFilm(this.data.newsReportId, body)
      : this.curationSubmit.postEpisodeToFilm(this.data.podcastId, this.data.episodeId, body);
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

  async move() {
    if (!this.canSend()) {
      return;
    }
    if (this.mode() === 'existing') {
      await this.mergeIntoExisting();
      return;
    }
    this.isSending.set(true);
    this.error.set(null);
    let body: EpisodeFilmMoveRequest = {};
    const title = this.requestTitle();
    if (title) {
      body = { title };
    }
    try {
      for (let round = 0; round < MAX_IDENTITY_ROUNDS; round++) {
        const resp = await firstValueFrom(this.send(body));
        const outcome = resp.body as EpisodeFilmMoveResponse | null;
        if (resp.status === 200 && outcome?.cancelled) {
          this.isSending.set(false);
          return;
        }
        if (resp.status === 200 && outcome?.identityDecision) {
          if (!outcome.identityDecision.candidates?.length) {
            this.isSending.set(false);
            this.error.set('No confident identity match.');
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
        // Contract: 202 = moved; 200 = identity/cancelled gate only (nothing written).
        if (resp.status === 202) {
          this.dialogRef.close({
            moved: true,
            filmId: outcome?.filmId ?? this.data.newsReportId ?? this.data.episodeId,
            name: outcome?.name ?? (this.requestTitle() ?? this.data.episodeTitle),
            ...(outcome?.emptiedNewsOrganisationId ? { emptiedNewsOrganisationId: outcome.emptiedNewsOrganisationId } : {})
          });
          return;
        }
        this.isSending.set(false);
        this.error.set('Unexpected response while moving to film.');
        return;
      }
      this.isSending.set(false);
      this.error.set('Identity lookup stopped after too many prompts.');
    } catch (e) {
      this.isSending.set(false);
      const err = e as HttpErrorResponse;
      const clash = err?.status === 409 ? (err.error as EpisodeFilmMoveResponse | null) : null;
      if (this.canMergeIntoExisting && clash?.filmId) {
        // The name belongs to a film already in the catalogue: offer to merge into it (RPP #1522).
        this.mode.set('existing');
        this.existingFilm.set({ id: clash.filmId, name: clash.name ?? null });
        this.filmQuery.setValue(clash.name ?? clash.filmId, { emitEvent: false });
        this.error.set('A film with this name already exists. It is picked under Existing film: Merge into film adds this episode to it.');
      } else {
        this.error.set(moveErrorMessage(err, this.item));
      }
      console.error(e);
    }
  }

  /** POST { filmId }: merge the episode into the picked existing film (RPP #1522). */
  private async mergeIntoExisting(): Promise<void> {
    const film = this.existingFilm();
    if (!film) {
      return;
    }
    this.isSending.set(true);
    this.error.set(null);
    try {
      const resp = await firstValueFrom(this.send({ filmId: film.id }));
      const outcome = resp.body as EpisodeFilmMoveResponse | null;
      if (resp.status === 202) {
        this.dialogRef.close({
          moved: true,
          merged: true,
          filmId: outcome?.filmId ?? film.id,
          name: outcome?.name ?? film.name ?? undefined
        });
        return;
      }
      this.isSending.set(false);
      this.error.set('Unexpected response while merging into the film.');
    } catch (e) {
      this.isSending.set(false);
      this.error.set(mergeErrorMessage(e as HttpErrorResponse));
      console.error(e);
    }
  }

  private async answerIdentity(
    prompt: AmbiguousIdentityPrompt,
    previous: EpisodeFilmMoveRequest
  ): Promise<EpisodeFilmMoveRequest | null> {
    const identity = await promptAmbiguousIdentity(this.identityDialog, prompt);
    if (!identity || identity.decision === 'cancel') {
      await firstValueFrom(this.send({ ...previous, identityDecision: 'cancel' })).catch(() => undefined);
      return null;
    }
    return {
      ...previous,
      identityDecision: identity.decision,
      ...(identity.decision === 'select' ? { selectedIdentityKey: identity.key } : {})
    };
  }

  cancel() {
    this.dialogRef.close({ moved: false });
  }
}

export function moveErrorMessage(e: HttpErrorResponse, item = 'episode'): string {
  const body = e.error as { error?: string } | null | undefined;
  switch (e.status) {
    case 409:
      return 'A film with this name already exists. Choose a different title.';
    case 400:
      return body?.error ?? `The ${item} cannot be moved to a film.`;
    case 404:
      return `The ${item} was not found. It may already have been moved.`;
    default:
      return `An error occurred moving the ${item}. Sending again resumes an interrupted move.`;
  }
}

/** Merge into an existing film: the server's 400 / 409 text says why (e.g. the film already has another YouTube link). */
export function mergeErrorMessage(e: HttpErrorResponse): string {
  const body = e.error as { error?: string } | null | undefined;
  switch (e.status) {
    case 409:
      return body?.error ?? 'The film already has a different link for one of this episode\'s services.';
    case 400:
      return body?.error ?? 'The episode cannot be merged into this film.';
    case 404:
      return 'The episode or the film was not found. The episode may already have been moved.';
    default:
      return 'An error occurred merging into the film. Sending again resumes an interrupted merge.';
  }
}
