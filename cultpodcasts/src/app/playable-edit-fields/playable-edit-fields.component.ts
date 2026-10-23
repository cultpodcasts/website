import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, input, model, OnInit, signal } from '@angular/core';
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
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom } from 'rxjs';
import subjectNamesConfig from '../hoisted-subject-names.json';
import { CurationSubmitService } from '../curation-submit.service';
import { EditPersonDialogComponent } from '../edit-person-dialog/edit-person-dialog.component';
import { FilmLinksEditComponent } from '../film-links-edit/film-links-edit.component';
import { FilmTrailersEditComponent } from '../film-trailers-edit/film-trailers-edit.component';
import {
  applyGuestSelection,
  hasNonEmptyUrlValue,
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
import { PlayableEditForm, playableEditHasIdentity, PlayableEditVariant } from '../playable-edit-form.util';
import { applySubjectFilterKey, isDesktopSubjectTypingEnabled } from '../subject-filter.util';

/**
 * The tabbed body shared by the news report, TV episode and film edit dialogs, laid out like the podcast
 * Edit Episode dialog: Details, Flags, Meta (release, duration, subjects, search terms, hash tag,
 * language), Guests, and Identity (IMDb, plus TheTVDB when the form has it) for the `tv` and `film` variants.
 * The `film` variant swaps the parent row and Title for a read-only Name plus Publisher, takes a year-or-date release,
 * adds the IMDb / TMDB ids to Identity, and adds Links (its service URLs) and Trailers tabs. News and TV have no
 * Urls / Images tabs: their PATCH does not edit service links.
 */
@Component({
  selector: 'app-playable-edit-fields',
  imports: [
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
  /** TV / film: the Identity tab (IMDb; TheTVDB shows when the form has `tvdb`). */
  protected readonly identity = computed(() => playableEditHasIdentity(this.variant()));
  /** Film: read-only Name (renames are admin-only), Publisher, no parent row, year-or-date release. */
  protected readonly film = computed(() => this.variant() === 'film');

  private readonly dialog = inject(MatDialog);
  private readonly curation = inject(CurationSubmitService);
  private readonly cdr = inject(ChangeDetectorRef);
  protected readonly featureSwitchService = inject(FeatureSwitchService);

  protected readonly FeatureSwitch = FeatureSwitch;
  protected readonly personLabel = personLabel;
  protected readonly noCompareFunction = noCompareFunction;
  protected readonly hasNonEmptyUrlValue = hasNonEmptyUrlValue;
  protected readonly openExternalUrl = openExternalUrl;
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
