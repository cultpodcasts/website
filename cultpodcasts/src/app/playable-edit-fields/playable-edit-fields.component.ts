import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, input, model, OnInit, output, signal } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { CdkTextareaAutosize, TextFieldModule } from '@angular/cdk/text-field';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom } from 'rxjs';
import subjectNamesConfig from '../hoisted-subject-names.json';
import {
  applyIdentityIds,
  filmReleaseYear,
  runCatalogueIdentityLookup
} from '../catalogue-identity-lookup';
import { CatalogueIdentityLookupRequest } from '../catalogue-identity-lookup.interface';
import { ConfirmComponent } from '../confirm/confirm.component';
import { CurationSubmitService } from '../curation-submit.service';
import { EditPersonDialogComponent } from '../edit-person-dialog/edit-person-dialog.component';
import { FilmImagesEditComponent } from '../film-images-edit/film-images-edit.component';
import { FilmLinksEditComponent } from '../film-links-edit/film-links-edit.component';
import { FilmTrailersEditComponent } from '../film-trailers-edit/film-trailers-edit.component';
import {
  applyGuestSelection,
  noCompareFunction,
  openExternalUrl,
  personLabel,
  regroupGuests,
  regroupSubjects
} from '../episode-form.util';
import { FeatureSwitch } from '../feature-switch.enum';
import { FeatureSwitchService } from '../feature-switch-service';
import { Person } from '../person.interface';
import { normalizeHashTagControl } from '../podcast-form.util';
import { imdbTitleUrl, PlayableEditForm, playableEditHasIdentity, PlayableEditVariant, tmdbMovieUrl, tvdbEpisodeUrl } from '../playable-edit-form.util';
import { applySubjectFilterKey, isDesktopSubjectTypingEnabled } from '../subject-filter.util';
import { SELECT_REORDER } from '../select-reorder';

/** Filled parent-show identity ids after an immediate TV-show PATCH from episode Look up. */
export interface ParentIdentityFilled {
  imdbId: string | null;
  tmdbId: number | null;
  tvdbId: number | null;
}

/**
 * The tabbed body shared by the news report, TV episode and film edit dialogs, in the podcast Edit Episode
 * dialog's tab order: Details, Flags, Urls, Meta (release, duration, subjects, search terms, hash tag, language),
 * Images, Guests. Urls and Images edit `services` (page URL and image URL per key; same PATCH shape as film / podcast
 * episode). The `film` variant adds Trailers straight after Images. The `tv` and `film` variants add Identity last
 * (id inputs: IMDb / TMDB, plus TheTVDB when the form has it). The `film` variant also swaps the parent row and Title
 * for a read-only Name plus Publisher and takes a year-or-date release.
 */
@Component({
  selector: 'app-playable-edit-fields',
  imports: [
    SELECT_REORDER,
    ReactiveFormsModule,
    KeyValuePipe,
    CdkTextareaAutosize,
    TextFieldModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,
    FilmLinksEditComponent,
    FilmImagesEditComponent,
    FilmTrailersEditComponent
  ],
  templateUrl: './playable-edit-fields.component.html',
  styleUrl: './playable-edit-fields.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlayableEditFieldsComponent implements OnInit {
  readonly form = input.required<FormGroup<PlayableEditForm>>();
  /** "News Outlet" / "TV Show". */
  readonly parentLabel = input.required<string>();
  readonly parentName = input<string>('');
  /** TV episode: parent show guid (for applying parentIds from lookup). */
  readonly parentId = input<string>('');
  readonly parentImdbId = input<string | null>(null);
  readonly parentTmdbId = input<number | null>(null);
  readonly parentTvdbId = input<number | null>(null);
  /** Owning dialog updates its parent-id signals after an immediate show PATCH. */
  readonly parentIdentityFilled = output<ParentIdentityFilled>();
  /** Every subject option (playable subjects first, then the catalogue). */
  readonly subjectNames = input<string[]>([]);
  /** The parent's default subject, hoisted to the top like the podcast default. */
  readonly defaultSubject = input<string | null>(null);
  readonly people = input<Person[]>([]);
  readonly languages = input<Record<string, string>>({});
  readonly blueskyPosted = input(false);
  /** Bold underline on the Meta tab when this create stored a detected default language. */
  readonly highlightDefaultLanguage = input(false);
  readonly pendingUnBluesky = model(false);
  /** Which playable: drives the Identity tab (TV / film) and the film Details / Release fields. */
  readonly variant = input<PlayableEditVariant>('news');
  /** TV / film: the Identity tab (IMDb id; TheTVDB id shows when the form has `tvdbId`). */
  protected readonly identity = computed(() => playableEditHasIdentity(this.variant()));
  /** Film: read-only Name (renames are admin-only), Publisher, no parent row, year-or-date release. */
  protected readonly film = computed(() => this.variant() === 'film');

  private readonly dialog = inject(MatDialog);
  private readonly curation = inject(CurationSubmitService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);
  protected readonly featureSwitchService = inject(FeatureSwitchService);
  protected readonly lookingUpIdentity = signal(false);
  protected readonly identityLookupMessage = signal('');
  /** Local mirrors so a second Look up sees filled show ids before input bindings refresh. */
  private readonly parentImdbOverride = signal<string | null | undefined>(undefined);
  private readonly parentTmdbOverride = signal<number | null | undefined>(undefined);
  private readonly parentTvdbOverride = signal<number | null | undefined>(undefined);

  protected readonly FeatureSwitch = FeatureSwitch;
  protected readonly personLabel = personLabel;
  protected readonly noCompareFunction = noCompareFunction;
  protected readonly openExternalUrl = openExternalUrl;
  protected readonly imdbUrl = imdbTitleUrl;
  /** TV: TheTVDB episode page (the TV variant edits an episode id). */
  protected readonly tvdbUrl = tvdbEpisodeUrl;
  /** Film: TMDB movie page. TV episode TMDB has no single-id page URL here. */
  protected readonly tmdbUrl = (id: string | null | undefined) =>
    this.film() ? tmdbMovieUrl(id) : '';
  protected readonly typingFilter = isDesktopSubjectTypingEnabled();
  private readonly hoistedSubjectNames: string[] = subjectNamesConfig.hostedSubjectNames;

  protected readonly selectedSubjects = signal<string[]>([]);
  protected readonly hoistedSubjects = signal<string[]>([]);
  protected readonly otherSubjects = signal<string[]>([]);
  protected readonly subjectsFilterTerm = signal('');
  private allPeople: Person[] = [];
  protected readonly selectedGuests = signal<Person[]>([]);
  protected readonly otherPeople = signal<Person[]>([]);
  protected readonly guestsFilterTerm = signal('');

  ngOnInit(): void {
    this.allPeople = [...this.people()];
    this.regroupSubjects();
    this.regroupGuests();
  }

  protected markRemoveBlueskyPost(): void {
    if (this.blueskyPosted()) {
      this.pendingUnBluesky.set(true);
    }
  }

  protected cancelRemoveBlueskyPost(): void {
    this.pendingUnBluesky.set(false);
  }

  protected normalizeHashTag(): void {
    normalizeHashTagControl(this.form().controls.hashTag);
  }

  protected clearField(control: FormControl<string>): void {
    control.setValue('');
    control.markAsDirty();
  }

  protected async lookUpIdentity(): Promise<void> {
    if (this.lookingUpIdentity() || !this.identity()) {
      return;
    }
    const form = this.form();
    const title = form.controls.title.value.trim();
    if (!title) {
      this.identityLookupMessage.set('Enter a title before looking up identity.');
      return;
    }
    this.lookingUpIdentity.set(true);
    this.identityLookupMessage.set('');
    try {
      const request = this.buildLookupRequest(title);
      const outcome = await runCatalogueIdentityLookup(
        this.dialog,
        (body) => this.curation.lookupCatalogueIdentity(body),
        request
      );
      if (outcome.kind === 'cancelled') {
        return;
      }
      if (outcome.kind === 'noMatch' || outcome.kind === 'error') {
        this.identityLookupMessage.set(outcome.message);
        this.snackBar.open(outcome.message, 'Ok', { duration: 8000 });
        return;
      }
      const applied = this.applyMatchedIds(outcome.ids);
      let parentSaved = false;
      if (this.variant() === 'tv' && outcome.parentIds && this.parentId()) {
        parentSaved = await this.patchParentBlanks(outcome.parentIds);
      }
      const parts: string[] = [];
      if (applied) {
        parts.push(
          this.film()
            ? 'Filled blank film identity. Save to keep.'
            : 'Filled blank episode identity. Save to keep.'
        );
      }
      if (parentSaved) {
        parts.push('Blank show identity was already saved on the TV show.');
      }
      const msg = parts.length
        ? parts.join(' ')
        : 'Lookup matched, but no blank identity fields to fill.';
      this.identityLookupMessage.set(msg);
      this.snackBar.open(msg, 'Ok', { duration: 8000 });
      this.cdr.markForCheck();
    } finally {
      this.lookingUpIdentity.set(false);
    }
  }

  private effectiveParentImdbId(): string | null {
    const override = this.parentImdbOverride();
    return override !== undefined ? override : this.parentImdbId();
  }

  private effectiveParentTmdbId(): number | null {
    const override = this.parentTmdbOverride();
    return override !== undefined ? override : this.parentTmdbId();
  }

  private effectiveParentTvdbId(): number | null {
    const override = this.parentTvdbOverride();
    return override !== undefined ? override : this.parentTvdbId();
  }

  private buildLookupRequest(title: string): CatalogueIdentityLookupRequest {
    if (this.film()) {
      return {
        kind: 'Film',
        title,
        year: filmReleaseYear(this.form().controls.release.value)
      };
    }
    return {
      kind: 'TvShowEpisode',
      title,
      showName: this.parentName().trim() || undefined,
      showImdbId: this.effectiveParentImdbId() || undefined,
      showTmdbId: this.effectiveParentTmdbId() ?? undefined,
      showTvdbId: this.effectiveParentTvdbId() ?? undefined
    };
  }

  private applyMatchedIds(ids: {
    imdbId?: string | null;
    tmdbId?: number | null;
    tvdbId?: number | null;
  }): boolean {
    const form = this.form();
    const filled = applyIdentityIds(
      {
        imdbId: form.controls.imdbId?.value,
        tmdbId: form.controls.tmdbId?.value,
        tvdbId: form.controls.tvdbId?.value
      },
      ids
    );
    if (filled.imdbId != null && form.controls.imdbId) {
      form.controls.imdbId.setValue(filled.imdbId);
      form.controls.imdbId.markAsDirty();
    }
    if (filled.tmdbId != null && form.controls.tmdbId) {
      form.controls.tmdbId.setValue(filled.tmdbId);
      form.controls.tmdbId.markAsDirty();
    }
    if (filled.tvdbId != null && form.controls.tvdbId) {
      form.controls.tvdbId.setValue(filled.tvdbId);
      form.controls.tvdbId.markAsDirty();
    }
    return filled.changed;
  }

  private async patchParentBlanks(parentIds: {
    imdbId?: string | null;
    tmdbId?: number | null;
    tvdbId?: number | null;
  }): Promise<boolean> {
    const parentId = this.parentId();
    if (!parentId) {
      return false;
    }
    const filled = applyIdentityIds(
      {
        imdbId: this.effectiveParentImdbId(),
        tmdbId: this.effectiveParentTmdbId(),
        tvdbId: this.effectiveParentTvdbId()
      },
      parentIds
    );
    if (!filled.changed) {
      return false;
    }
    const confirmed = await firstValueFrom(
      this.dialog
        .open(ConfirmComponent, {
          data: {
            title: 'Update TV show identity?',
            question:
              'Also fill blank show identity ids on the TV show now? This saves immediately and cannot be undone by cancelling this episode dialog.'
          }
        })
        .afterClosed()
    );
    if ((confirmed as { result?: boolean } | undefined)?.result !== true) {
      return false;
    }
    const body: {
      imdbId?: string;
      tmdbId?: number;
      tvdbId?: number;
    } = {};
    if (filled.imdbId != null) {
      body.imdbId = filled.imdbId;
    }
    if (filled.tmdbId != null) {
      body.tmdbId = Number(filled.tmdbId);
    }
    if (filled.tvdbId != null) {
      body.tvdbId = Number(filled.tvdbId);
    }
    try {
      await firstValueFrom(this.curation.patchCatalogueParent('tv', parentId, body));
      const next: ParentIdentityFilled = {
        imdbId: filled.imdbId ?? this.effectiveParentImdbId(),
        tmdbId: filled.tmdbId != null ? Number(filled.tmdbId) : this.effectiveParentTmdbId(),
        tvdbId: filled.tvdbId != null ? Number(filled.tvdbId) : this.effectiveParentTvdbId()
      };
      this.parentImdbOverride.set(next.imdbId);
      this.parentTmdbOverride.set(next.tmdbId);
      this.parentTvdbOverride.set(next.tvdbId);
      this.parentIdentityFilled.emit(next);
      return true;
    } catch {
      this.snackBar.open('Matched show identity but saving the TV show failed.', 'Ok', { duration: 8000 });
      return false;
    }
  }

  protected regroupSubjects(): void {
    const grouped = regroupSubjects(
      this.form().controls.subjects.value,
      this.subjectNames(),
      this.defaultSubject(),
      this.hoistedSubjectNames,
      this.subjectsFilterTerm()
    );
    this.selectedSubjects.set(grouped.selectedSubjects);
    this.hoistedSubjects.set(grouped.hoistedSubjects);
    this.otherSubjects.set(grouped.otherSubjects);
  }

  protected onSubjectsOpenChange(opened: boolean): void {
    if (!opened) {
      this.subjectsFilterTerm.set('');
      this.regroupSubjects();
    }
  }

  protected onSubjectsKeydown(event: KeyboardEvent): void {
    applySubjectFilterKey(event, this.subjectsFilterTerm, this.typingFilter);
    this.regroupSubjects();
  }

  protected regroupGuests(): void {
    const grouped = regroupGuests(this.allPeople, undefined, this.form().controls.guests.value, this.guestsFilterTerm());
    this.selectedGuests.set(grouped.selectedGuests);
    this.otherPeople.set(grouped.otherPeople);
  }

  protected onGuestsOpenChange(opened: boolean): void {
    if (!opened) {
      this.guestsFilterTerm.set('');
      this.regroupGuests();
    }
  }

  protected onGuestsKeydown(event: KeyboardEvent): void {
    applySubjectFilterKey(event, this.guestsFilterTerm, this.typingFilter);
    this.regroupGuests();
  }

  protected openAddPerson(): void {
    this.dialog.open(EditPersonDialogComponent, {
      data: { create: true, personName: this.guestsFilterTerm() || undefined },
      disableClose: true,
      autoFocus: true,
      width: '90%'
    }).afterClosed().subscribe(async (result) => {
      if (result?.updated && result.personName) {
        await this.refreshPeopleAndSelect(result.personName, result.person);
      }
    });
  }

  protected openEditPerson(person: Person): void {
    this.dialog.open(EditPersonDialogComponent, {
      data: { create: false, personName: person.name },
      disableClose: true,
      autoFocus: true,
      width: '90%'
    }).afterClosed().subscribe(async (result) => {
      if (result?.updated) {
        await this.refreshPeopleAndSelect(person.name);
      }
    });
  }

  private async refreshPeopleAndSelect(personName: string, created?: Person): Promise<void> {
    let fetched: Person[] | undefined;
    try {
      fetched = await firstValueFrom(this.curation.getPeople());
    } catch {
      fetched = undefined;
    }
    const result = applyGuestSelection({
      allPeople: this.allPeople,
      fetched,
      currentGuests: this.form().controls.guests.value,
      personName,
      person: created,
      filterTerm: ''
    });
    this.allPeople = result.allPeople;
    this.guestsFilterTerm.set('');
    this.selectedGuests.set(result.selectedGuests);
    this.otherPeople.set(result.otherPeople);
    this.cdr.detectChanges();
    this.form().controls.guests.setValue(result.guests);
    this.form().controls.guests.markAsDirty();
  }
}
