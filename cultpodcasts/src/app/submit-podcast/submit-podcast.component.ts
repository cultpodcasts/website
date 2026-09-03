import { Component, ChangeDetectionStrategy, ChangeDetectorRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormGroup, Validators, FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef, MatDialogModule } from "@angular/material/dialog";
import { AsyncPipe } from '@angular/common';
import { Observable, from, map, of, startWith, switchMap, catchError, tap, timeout } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { UrlValidator } from '../url.validator';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import {
  displaySeriesFormValue,
  seriesNameFromForm,
  showSubmitSeriesPicker,
  submitDialogResult,
  submitSaveReady,
  submitSeriesUiFromLookup,
  SubmitSeriesFormValue
} from '../submit-series.util';
import { generalDropSeriesForActor, shouldCallSubmitUrlLookup } from '../submit-ingest-ux';
import { resolveAmbiguousPodcastIds, resolveSeriesForSubmit } from '../submit-series-conflict';
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
const URL_LOOKUP_TIMEOUT_MS = 15_000;

export interface SubmitPodcastDialogData {
  attachToPage?: boolean;
}

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
export class SubmitPodcastComponent {
  private readonly dialogRef = inject(MatDialogRef<SubmitPodcastComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthServiceWrapper);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly suggestions = inject(SearchSuggestionsService);
  private readonly seriesResolve = inject(SubmitSeriesResolveService);
  private readonly urlLookup = inject(SubmitUrlLookupService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogData = inject<SubmitPodcastDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly urlCaptureOnly = this.dialogData?.attachToPage === true;

  form: FormGroup;
  advancedOpenState: boolean = false;
  podcast = new FormControl<SubmitSeriesFormValue>(null);
  url = new FormControl('');
  filteredOptions: Observable<Suggestion[]> | undefined;
  protected readonly resolving = signal(false);
  protected readonly lookupPending = signal(false);
  protected readonly lookup = signal<SubmitUrlLookupResponse | 'error' | null>(null);
  protected readonly lookedUpHref = signal<string | null>(null);
  protected readonly urlText = signal('');

  protected readonly authRoles = toSignal(this.auth.roles, { initialValue: [] as string[] });
  protected readonly isCurator = computed(() => showSubmitSeriesPicker(this.authRoles()));
  protected readonly canCallSubmitUrlLookup = computed(() => shouldCallSubmitUrlLookup(this.authRoles()));
  protected readonly seriesUi = computed(() => {
    if (this.urlCaptureOnly || !this.isCurator()) {
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
    this.auth.roles.pipe(
      takeUntilDestroyed(),
      tap(roles => {
        if (showSubmitSeriesPicker(roles)) {
          this.suggestions.preload();
          this.ensureSeriesTypeahead();
        }
      })
    ).subscribe();

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
      tap(value => this.markUrlLookupDirty(value)),
      debounceTime(URL_LOOKUP_DEBOUNCE_MS),
      distinctUntilChanged(),
      takeUntilDestroyed(),
      switchMap(value => this.lookupUrl(value))
    ).subscribe(result => {
      this.lookupPending.set(false);
      if (result.kind === 'cleared') {
        this.lookedUpHref.set(null);
        this.lookup.set(null);
      } else if (result.kind === 'skipped') {
        this.lookedUpHref.set(result.href);
        this.lookup.set(null);
      } else {
        this.lookedUpHref.set(result.href);
        this.lookup.set(result.lookup);
        if (result.lookup !== 'error' && result.lookup.known) {
          this.podcast.setValue(null);
        } else if (
          result.lookup !== 'error' &&
          !result.lookup.known &&
          !result.lookup.ambiguous &&
          result.lookup.kind === 'streaming' &&
          result.lookup.podcastName &&
          !seriesNameFromForm(this.podcast.value)
        ) {
          this.podcast.setValue(result.lookup.podcastName);
        }
      }
      this.changeDetector.markForCheck();
    });
  }

  /** Pending from the first keystroke so Save cannot use a stale lookup for another URL. */
  private markUrlLookupDirty(value: string) {
    this.urlText.set(value);
    const parsed = parseSubmittablePodcastUrl(value);
    if (!parsed) {
      this.lookupPending.set(false);
      this.lookedUpHref.set(null);
      this.lookup.set(null);
    } else if (
      this.urlCaptureOnly ||
      !shouldCallSubmitUrlLookup(this.authRoles()) ||
      parsed.href === this.lookedUpHref()
    ) {
      this.lookupPending.set(false);
    } else {
      this.lookupPending.set(true);
    }
    this.changeDetector.markForCheck();
  }

  private lookupUrl(value: string) {
    const parsed = parseSubmittablePodcastUrl(value);
    if (!parsed) {
      return of({ kind: 'cleared' as const });
    }
    if (this.urlCaptureOnly || !shouldCallSubmitUrlLookup(this.authRoles())) {
      return of({ kind: 'skipped' as const, href: parsed.href });
    }
    return from(this.urlLookup.lookup(parsed.toString())).pipe(
      timeout(URL_LOOKUP_TIMEOUT_MS),
      map(lookup => ({ kind: 'ready' as const, href: parsed.href, lookup })),
      catchError(() => of({ kind: 'ready' as const, href: parsed.href, lookup: 'error' as const }))
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
    if (!this.form.valid || this.resolving()) {
      return;
    }

    const url = this.url.value ?? '';
    const parsed = parseSubmittablePodcastUrl(url);
    if (!submitSaveReady(
      this.canCallSubmitUrlLookup(),
      parsed?.href,
      this.lookedUpHref(),
      this.lookupPending(),
      this.urlCaptureOnly
    )) {
      return;
    }

    if (!this.isCurator() || this.urlCaptureOnly) {
      const series = generalDropSeriesForActor(this.authRoles(), this.lookup());
      this.dialogRef.close({
        url,
        podcast: series.podcastName ?? undefined
      });
      return;
    }

    const plan = submitDialogResult(url, this.lookup(), this.podcast.value);
    if (plan.kind === 'close') {
      this.dialogRef.close({ url: plan.url, podcast: plan.podcast });
      return;
    }

    this.resolving.set(true);
    try {
      const outcome = plan.kind === 'ambiguous'
        ? await resolveAmbiguousPodcastIds(this.seriesResolve, this.dialog, plan.podcastIds, seriesNameFromForm(this.podcast.value))
        : await resolveSeriesForSubmit(this.seriesResolve, this.dialog, plan.seriesName);
      if (outcome.kind === 'cancelled') {
        return;
      }
      if (outcome.kind === 'error') {
        this.snackBar.open('Could not resolve series. Try again or pick a different name.', 'Ok', { duration: 5000 });
        return;
      }
      if (plan.kind === 'ambiguous') {
        if (!outcome.selection.podcastId) {
          this.snackBar.open('Could not resolve series. Try again or pick a different name.', 'Ok', { duration: 5000 });
          return;
        }
        this.dialogRef.close({
          url,
          podcast: { id: outcome.selection.podcastId, name: outcome.selection.podcastName }
        });
        return;
      }
      const podcast = outcome.selection.podcastId
        ? { id: outcome.selection.podcastId, name: outcome.selection.podcastName ?? plan.seriesName }
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
