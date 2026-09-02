import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormGroup, Validators, FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from "@angular/material/dialog";
import { AsyncPipe } from '@angular/common';
import { Observable, map, startWith } from 'rxjs';
import { UrlValidator } from '../url.validator';
import { SimplePodcast } from '../simple-podcast.interface';
import { PodcastsService } from '../podcasts.service';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { showSubmitSeriesPicker } from '../submit-series.util';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { TextFieldModule } from '@angular/cdk/text-field';

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
    AsyncPipe
  ]
})
export class SubmitPodcastComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<SubmitPodcastComponent>);
  private readonly podcastsService = inject(PodcastsService);
  private readonly auth = inject(AuthServiceWrapper);
  private readonly changeDetector = inject(ChangeDetectorRef);

  form!: FormGroup;
  advancedOpenState: boolean = false;
  podcast = new FormControl<string | SimplePodcast | null>(null);
  url = new FormControl('');
  filteredOptions: Observable<SimplePodcast[]> | undefined;
  options: SimplePodcast[] | undefined;
  private loadedSeriesOptions = false;

  protected readonly authRoles = toSignal(this.auth.roles, { initialValue: [] as string[] });
  protected readonly isCurator = computed(() => showSubmitSeriesPicker(this.authRoles()));

  constructor() {
    this.auth.roles.pipe(takeUntilDestroyed()).subscribe(roles => {
      if (showSubmitSeriesPicker(roles)) {
        void this.ensureSeriesOptions();
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
  }

  private async ensureSeriesOptions() {
    if (this.loadedSeriesOptions) {
      return;
    }
    this.loadedSeriesOptions = true;
    const result = await this.podcastsService.getPodcasts();
    this.options = result.results ?? [];
    this.filteredOptions = this.podcast.valueChanges.pipe(
      startWith(this.podcast.value),
      map(value => this.filterPodcasts(value))
    );
    this.changeDetector.markForCheck();
  }

  displayFn(podcast: SimplePodcast | string | null): string {
    if (!podcast) {
      return '';
    }
    return typeof podcast === 'string' ? podcast : podcast.name;
  }

  save() {
    if (this.form.valid) {
      this.dialogRef.close(
        this.form.value
      );
    }
  }

  close() {
    this.dialogRef.close();
  }

  private filterPodcasts(value: string | SimplePodcast | null): SimplePodcast[] {
    const options = this.options ?? [];
    const term = (typeof value === 'string' ? value : value?.name ?? '').trim().toLowerCase();
    if (!term) {
      return options;
    }
    return options.filter(podcast => podcast.name.toLowerCase().includes(term));
  }
}
