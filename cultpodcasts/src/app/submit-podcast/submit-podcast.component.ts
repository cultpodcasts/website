import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, computed, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormGroup, Validators, FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogRef, MatDialogModule } from "@angular/material/dialog";
import { AsyncPipe } from '@angular/common';
import { Observable, from, map, of, startWith, switchMap, catchError } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { UrlValidator } from '../url.validator';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import {
  displaySeriesFormValue,
  seriesNameFromForm,
  showSubmitSeriesPicker,
  submitSeriesUiFromLookup,
  SubmitSeriesFormValue
} from '../submit-series.util';
import { resolveSeriesForSubmit } from '../submit-series-conflict';
import { SubmitSeriesResolveService } from '../submit-series-resolve.service';
import { SubmitUrlLookupService } from '../submit-url-lookup.service';
import { SubmitUrlLookupResponse } from '../submit-url-lookup.interface';
import { classifySubmittablePodcastUrl, parseSubmittablePodcastUrl } from '../podcast-url-matcher';
import { SearchSuggestionsService } from '../search-suggestions.service';
import { Suggestion } from '../search-suggestions.interface';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatSnackBar } from '@angular/material/snack-bar';

const SERIES_SUGGEST_DEBOUNCE_MS = 150;
const URL_LOOKUP_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-submit-podcast',
  templateUrl: './submit-podcast.component.html',
  styleUrls: ['./submit-podcast.component.sass'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatExpansionModule,
    MatAutocompleteModule,
    MatOptionModule,
    MatButtonModule,
    TextFieldModule,
    MatProgressSpinnerModule,
    AsyncPipe
  ]
})
export class SubmitPodcastComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<SubmitPodcastComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthServiceWrapper);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly suggestions = inject(SearchSuggestionsService);
  private readonly seriesResolve = inject(SubmitSeriesResolveService);
  private readonly urlLookup = inject(SubmitUrlLookupService);
  private readonly snackBar = inject(MatSnackBar);

  form!: FormGroup;
  advancedOpenState: boolean = false;
  podcast = new FormControl<SubmitSeriesFormValue>(null);
  url = new FormControl('');
  filteredOptions: Observable<Suggestion[]> | undefined;
  protected readonly resolving = signal(false);
  protected readonly lookupPending = signal(false);
  protected readonly lookup = signal<SubmitUrlLookupResponse | 'error' | null>(null);
  protected readonly urlText = signal('');

  protected readonly authRoles = toSignal(this.auth.roles, { initialValue: [] as string[] });
  protected readonly isCurator = computed(() => showSubmitSeriesPicker(this.authRoles()));
  protected readonly seriesUi = computed(() => {
    if (!this.isCurator()) {
      return 'hide' as const;
    }
    return submitSeriesUiFromLookup(
      this.lookupPending() ? 'pending' : this.lookup(),
      classifySubmittablePodcastUrl(this.urlText())
    );
  });
  protected readonly knownSeriesName = computed(() => {
    const lookup = this.lookup();
    return lookup && lookup !== 'error' && lookup.known ? lookup.podcastName : '';
  });

  constructor() {
    this.auth.roles.pipe(takeUntilDestroyed()).subscribe(roles => {
      if (showSubmitSeriesPicker(roles)) {
        this.suggestions.preload();
        this.ensureSeriesTypeahead();
      }
    });
  }

  async ngOnInit() {
    this.url.addValidators([
      Validators.required,
      UrlValidator.isValid(),
      UrlValidator.isSubmittable()
    ]);
    this.form = new FormGroup({
      url: this.url,
      podcast: this.podcast
    });
    this.url.valueChanges.pipe(
      startWith(this.url.value),
      map(value => String(value ?? '').trim()),
      debounceTime(URL_LOOKUP_DEBOUNCE_MS),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
      switchMap(value => this.lookupUrl(value))
    ).subscribe(result => {
      this.lookupPending.set(false);
      if (result === 'cleared') {
        this.lookup.set(null);
      } else {
        this.lookup.set(result);
        if (result !== 'error' && result.known) {
          this.podcast.setValue(null);
        }
      }
      this.changeDetector.markForCheck();
    });
  }

  private lookupUrl(value: string) {
    this.urlText.set(value);
    const parsed = parseSubmittablePodcastUrl(value);
    if (!parsed) {
      return of('cleared' as const);
    }
    this.lookupPending.set(true);
    this.changeDetector.markForCheck();
    return from(this.urlLookup.lookup(parsed.toString())).pipe(
      catchError(() => of('error' as const))
    );
  }

  private ensureSeriesTypeahead() {
    if (this.filteredOptions) {
      return;
    }
    this.filteredOptions = this.podcast.valueChanges.pipe(
      startWith(this.podcast.value),
      map(value => seriesNameFromForm(value) ?? ''),
      debounceTime(SERIES_SUGGEST_DEBOUNCE_MS),
      switchMap(term => term ? from(this.suggestions.suggest(term, 8, 'podcast')) : of([]))
    );
    this.changeDetector.markForCheck();
  }

  readonly displayFn = displaySeriesFormValue;

  async save() {
    if (!this.form.valid || this.resolving() || this.lookupPending()) {
      return;
    }

    const url = this.url.value;
    const lookup = this.lookup();
    if (lookup && lookup !== 'error' && lookup.known) {
      this.dialogRef.close({ url, podcast: undefined });
      return;
    }

    const seriesName = seriesNameFromForm(this.podcast.value);
    if (!seriesName) {
      this.dialogRef.close({ url, podcast: undefined });
      return;
    }

    this.resolving.set(true);
    try {
      const outcome = await resolveSeriesForSubmit(this.seriesResolve, this.dialog, seriesName);
      if (outcome.kind === 'cancelled') {
        return;
      }
      if (outcome.kind === 'error') {
        this.snackBar.open('Could not resolve series. Try again or pick a different name.', 'Ok', { duration: 5000 });
        return;
      }
      const podcast = outcome.selection.podcastId
        ? { id: outcome.selection.podcastId, name: outcome.selection.podcastName ?? seriesName }
        : outcome.selection.podcastName;
      this.dialogRef.close({ url, podcast });
    } finally {
      this.resolving.set(false);
      this.changeDetector.markForCheck();
    }
  }

  close() {
    this.dialogRef.close();
  }
}
