import { ChangeDetectionStrategy, Component, DestroyRef, Inject, Injector, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  EpisodeFilmMoveRequest,
  EpisodeFilmMoveResponse,
  MoveEpisodeToFilmDialogClose,
  MoveEpisodeToFilmDialogData
} from '../episode-film-move.interface';
import { imdbIdPattern, int32Max } from '../playable-edit-form.util';
import { Suggestion } from '../search-suggestions.interface';
import { SearchSuggestionsService } from '../search-suggestions.service';
import { promptAmbiguousIdentity } from '../submit-language-identity-prompts';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The film picked from suggestions (id + name), or a pasted film id (no name yet). */
export interface ExistingFilmPick {
  id: string;
  name: string | null;
}

/** Indexer look-back (indexer__ReleasedDaysAgo = 2) plus a day for the YouTube publishing delay. */
export const RECENT_RELEASE_DAYS = 3;

const MAX_IDENTITY_ROUNDS = 4;

/** Non-exact catalogue rows to show. Exact-name rows are not capped (`SuggestOptions.allExactNames`). */
const FILM_SUGGEST_LIMIT = 10;

const CATALOGUE_UNAVAILABLE =
  'The film catalogue could not be loaded. Paste a film GUID to add this episode to an existing film.';

const UNRESOLVED_EXTERNAL_ID =
  'No catalogue film matches this IMDb or TMDB id.';

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

/** Films whose label or canonical name equals the typed text (catalogue title match, RPP #1525). */
export function filmsNamed<T extends { label: string; value: string }>(query: string, films: readonly T[]): T[] {
  const name = query.trim().toLowerCase();
  if (name.length === 0) {
    return [];
  }
  return films.filter(film =>
    film.label.trim().toLowerCase() === name || film.value.trim().toLowerCase() === name);
}

/**
 * Films whose suggestion row matched a pasted IMDb / TMDB id (`matchedAlias` from the index alias row,
 * RPP #1534). Title matches use {@link filmsNamed} instead.
 */
export function filmsMatchingExternalId<T extends { matchedAlias?: string }>(
  query: string,
  films: readonly T[]
): T[] {
  const id = query.trim().toLowerCase();
  if (id.length === 0) {
    return [];
  }
  return films.filter(film => (film.matchedAlias ?? '').trim().toLowerCase() === id);
}

/** True when the text is an IMDb title id (`tt…`) or a positive TMDB movie id (digits within int32). */
export function isFilmExternalIdPaste(text: string): boolean {
  const trimmed = text.trim();
  if (imdbIdPattern.test(trimmed)) {
    return true;
  }
  if (!/^[1-9]\d*$/.test(trimmed) || trimmed.length > 10) {
    return false;
  }
  return Number(trimmed) <= int32Max;
}

/**
 * Confirms and sends the curator "Move to film" command for one podcast episode, or for one news report when
 * `newsReportId` is set (RPP #1368: same body, identity prompt and outcome, POST /newsreport/{id}/film).
 *
 * For a podcast episode there is one name field (RPP #1525). It searches catalogue films by the name a new film
 * would be given (the typed title, or the episode title when the field is blank or unchanged). Move to film stays
 * disabled until that lookup has settled. One film with that exact name is selected, and Move to film merges into
 * it (`{ filmId }`, RPP #1522). Several films with that name must be picked. No match creates a new film. A pasted
 * film GUID is a merge and can be sent without waiting. A pasted IMDb (`tt…`) or TMDB id resolves via search
 * suggestions to that film and merges the same way (RPP #1534); an unresolved external id does not create a film
 * titled `tt…` / digits. If the catalogue cannot be loaded, create stays disabled and a film GUID can still be
 * pasted. News reports only create a film: merging into an existing one is not supported.
 */
@Component({
  selector: 'app-move-episode-to-film-dialog',
  imports: [
    MatAutocompleteModule,
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
  /** Typed film name. A suggestion pick writes the suggestion object in, then the label string. */
  readonly title: FormControl<string | Suggestion>;
  readonly isSending = signal(false);
  readonly error = signal<string | null>(null);
  private readonly identityDialog = inject(MatDialog);
  /** What moves, and what it leaves: a podcast episode, or a news report (RPP #1368). */
  readonly item: string;
  readonly source: string;
  /** Catalogue film search and merge are podcast episodes only (RPP #1522). */
  readonly canMergeIntoExisting: boolean;
  readonly films = signal<Suggestion[]>([]);
  readonly existingFilm = signal<ExistingFilmPick | null>(null);
  /** More than one catalogue film has the typed name, so the curator must pick which one. */
  readonly severalExact = signal(false);
  /** A title search has finished (so "no film has this name" is not shown before the answer). */
  readonly searched = signal(false);
  /** The lookup for the current text has finished. A pasted film id counts as settled. */
  private readonly lookupSettled = signal(false);
  /** The suggestions corpus failed to load, so an empty result is not "no such film". */
  private readonly suggestionsUnavailable = signal(false);
  private readonly injector = inject(Injector);
  private suggestionsService: SearchSuggestionsService | null = null;
  private queryVersion = 0;

  constructor(
    private dialogRef: MatDialogRef<MoveEpisodeToFilmDialogComponent, MoveEpisodeToFilmDialogClose>,
    @Inject(MAT_DIALOG_DATA) public data: MoveEpisodeToFilmDialogData,
    private curationSubmit: CurationSubmitService) {
    this.title = new FormControl<string | Suggestion>(data.episodeTitle ?? '', { nonNullable: true });
    this.item = data.newsReportId ? 'news report' : 'episode';
    this.source = data.newsReportId ? 'news organisation' : 'podcast';
    this.canMergeIntoExisting = !data.newsReportId;
    this.title.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(value => {
      if (typeof value === 'string') {
        void this.onName(value);
      }
    });
    if (this.canMergeIntoExisting) {
      this.suggestions.preload();
      void this.onName(this.nameText());
    }
  }

  /** Resolved on first use. News-report moves never need the suggestions service. */
  private get suggestions(): SearchSuggestionsService {
    this.suggestionsService ??= this.injector.get(SearchSuggestionsService);
    return this.suggestionsService;
  }

  nameText(): string {
    const value = this.title.value;
    return (typeof value === 'string' ? value : value?.label ?? '').trim();
  }

  /** Typing replaces any earlier pick; a pasted film GUID / IMDb / TMDB id is a pick on its own. */
  async onName(value: string): Promise<void> {
    if (!this.canMergeIntoExisting) {
      return;
    }
    const text = value.trim();
    this.error.set(null);
    this.severalExact.set(false);
    this.searched.set(false);
    if (GUID.test(text)) {
      this.queryVersion++;
      this.suggestionsUnavailable.set(false);
      this.existingFilm.set({ id: text.toLowerCase(), name: null });
      this.films.set([]);
      this.lookupSettled.set(true);
      return;
    }
    this.existingFilm.set(null);
    this.suggestionsUnavailable.set(false);
    this.lookupSettled.set(false);
    const version = ++this.queryVersion;
    const externalIdPaste = isFilmExternalIdPaste(text);
    const lookup = externalIdPaste ? text : this.createdName(text);
    if (lookup.length === 0) {
      this.films.set([]);
      this.lookupSettled.set(true);
      return;
    }
    let found: Suggestion[] = [];
    let unavailable = false;
    try {
      found = await this.suggestions.suggest(lookup, FILM_SUGGEST_LIMIT, 'film', { allExactNames: true });
      unavailable = this.suggestions.corpusLoadFailed();
    } catch (e) {
      console.error('Film suggestions failed; a film id can still be pasted.', e);
      unavailable = true;
    }
    if (version !== this.queryVersion) {
      return;
    }
    if (unavailable) {
      this.films.set([]);
      this.suggestionsUnavailable.set(true);
      this.lookupSettled.set(true);
      this.error.set(CATALOGUE_UNAVAILABLE);
      return;
    }
    const withId = found.filter(film => !!film.itemId);
    this.films.set(withId);
    // Title match wins over an IMDb/TMDB alias when both apply (e.g. a film titled with digits).
    const exactName = filmsNamed(lookup, withId);
    const exact = exactName.length > 0 ? exactName : filmsMatchingExternalId(lookup, withId);
    if (exact.length === 1) {
      const film = exact[0];
      this.existingFilm.set({ id: film.itemId!, name: film.value });
      this.searched.set(true);
    } else if (exact.length > 1) {
      this.severalExact.set(true);
      this.searched.set(true);
    } else if (externalIdPaste) {
      // Unresolved IMDb/TMDB must not create a film titled tt… / digits (GUID parity: merge or nothing).
      this.error.set(UNRESOLVED_EXTERNAL_ID);
    } else {
      this.searched.set(true);
    }
    this.lookupSettled.set(true);
  }

  onFilmSelected(event: MatAutocompleteSelectedEvent): void {
    const film = event.option.value as Suggestion;
    if (!film?.itemId) {
      return;
    }
    this.queryVersion++;
    this.severalExact.set(false);
    this.existingFilm.set({ id: film.itemId, name: film.value });
    this.title.setValue(film.label, { emitEvent: false });
  }

  /** Shows the label in the input after a pick (the option value is the suggestion). */
  displayFilm = (value: Suggestion | string | null): string =>
    typeof value === 'string' ? value : value?.label ?? '';

  canSend(): boolean {
    if (this.isSending()) {
      return false;
    }
    if (this.existingFilm()) {
      return true;
    }
    if (this.severalExact()) {
      return false;
    }
    if (this.canMergeIntoExisting && (!this.lookupSettled() || this.suggestionsUnavailable())) {
      return false;
    }
    // Unresolved IMDb/TMDB paste: merge only when matched; never create titled tt… / digits.
    if (this.canMergeIntoExisting && isFilmExternalIdPaste(this.nameText())) {
      return false;
    }
    return !this.hasInvalidTitle();
  }

  private send(body: EpisodeFilmMoveRequest) {
    return this.data.newsReportId
      ? this.curationSubmit.postNewsReportToFilm(this.data.newsReportId, body)
      : this.curationSubmit.postEpisodeToFilm(this.data.podcastId, this.data.episodeId, body);
  }

  /** The title to send: null keeps the episode title on the server. */
  requestTitle(): string | null {
    const value = this.nameText();
    const episode = (this.data.episodeTitle ?? '').trim();
    return value.length === 0 || value === episode ? null : value;
  }

  /** Name a new film is given: the typed override, or the episode title when the field is blank or unchanged. */
  nameToCreate(): string {
    return this.createdName(this.nameText());
  }

  private createdName(typed: string): string {
    const value = typed.trim();
    const episode = (this.data.episodeTitle ?? '').trim();
    return value.length === 0 || value === episode ? episode : value;
  }

  /** Released inside the Indexer's look-back, so the next index may re-add it to the podcast (RPP #1068). */
  isRecentlyReleased(): boolean {
    return releasedWithinDays(this.data.release, RECENT_RELEASE_DAYS, new Date());
  }

  hasInvalidTitle(): boolean {
    return this.nameText().includes('/');
  }

  async move() {
    if (!this.canSend()) {
      return;
    }
    if (this.existingFilm()) {
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
        // The name belongs to a film the suggestions had not shown. Select it so the next click merges.
        this.queryVersion++;
        this.severalExact.set(false);
        this.existingFilm.set({ id: clash.filmId, name: clash.name ?? null });
        this.title.setValue(clash.name ?? clash.filmId, { emitEvent: false });
        this.error.set('A film with this name already exists. It is selected: Move to film adds this episode to it.');
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
