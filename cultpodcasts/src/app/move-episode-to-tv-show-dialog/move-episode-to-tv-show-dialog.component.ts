import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CurationSubmitService } from '../curation-submit.service';
import {
  EpisodeTvShowMoveRequest,
  EpisodeTvShowMoveResponse,
  MoveEpisodeToTvShowDialogClose,
  MoveEpisodeToTvShowDialogData
} from '../episode-tv-show-move.interface';
import { RECENT_RELEASE_DAYS, releasedWithinDays } from '../move-episode-to-film-dialog/move-episode-to-film-dialog.component';
import { SearchSuggestionsService } from '../search-suggestions.service';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** BBC catch-all podcasts whose programmes become shows published by BBC. */
const BBC_PODCAST = /^bbc( three)?$/i;

/** The publisher a new show defaults to for an episode of this podcast. */
export function defaultPublisher(podcastName: string | null | undefined): string {
  return BBC_PODCAST.test((podcastName ?? '').trim()) ? 'BBC' : '';
}

/**
 * Confirms and sends the curator "Move to TV show" command for one podcast episode. The show is picked from the
 * search-suggestions TV show names (sent by name; the server matches case-insensitively), a pasted show id, or a
 * new show (name and publisher) when "Create a new TV show" is ticked.
 */
@Component({
  selector: 'app-move-episode-to-tv-show-dialog',
  imports: [
    MatAutocompleteModule,
    MatCheckboxModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule
  ],
  templateUrl: './move-episode-to-tv-show-dialog.component.html',
  styleUrl: './move-episode-to-tv-show-dialog.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MoveEpisodeToTvShowDialogComponent {
  private readonly dialogRef = inject<MatDialogRef<MoveEpisodeToTvShowDialogComponent, MoveEpisodeToTvShowDialogClose>>(MatDialogRef);
  private readonly curationSubmit = inject(CurationSubmitService);
  private readonly suggestions = inject(SearchSuggestionsService);
  readonly data = inject<MoveEpisodeToTvShowDialogData>(MAT_DIALOG_DATA);

  readonly showQuery = new FormControl<string>('', { nonNullable: true });
  readonly createShow = new FormControl<boolean>(false, { nonNullable: true });
  readonly publisher: FormControl<string>;
  readonly title: FormControl<string>;
  readonly shows = signal<string[]>([]);
  /** Form values as signals, so OnPush views follow programmatic changes (an autocomplete pick). */
  private readonly queryValue = toSignal(this.showQuery.valueChanges, { initialValue: this.showQuery.value });
  private readonly createShowValue = toSignal(this.createShow.valueChanges, { initialValue: this.createShow.value });
  private readonly publisherValue: () => string;
  private readonly titleValue: () => string;
  /** The query is a pasted TV show id rather than a name. */
  readonly isShowId = computed(() => GUID.test(this.queryValue().trim()));
  readonly hasInvalidName = computed(() => !this.isShowId() && this.queryValue().includes('/'));
  readonly isCreatingShow = computed(() => !this.isShowId() && this.createShowValue());
  /** The request body, or null while there is no valid target. */
  readonly request = computed<EpisodeTvShowMoveRequest | null>(() => this.buildRequest());
  readonly isSending = signal(false);
  readonly error = signal<string | null>(null);
  private queryVersion = 0;

  constructor() {
    this.publisher = new FormControl<string>(defaultPublisher(this.data.podcastName), { nonNullable: true });
    this.title = new FormControl<string>(this.data.episodeTitle ?? '', { nonNullable: true });
    this.publisherValue = toSignal(this.publisher.valueChanges, { initialValue: this.publisher.value });
    this.titleValue = toSignal(this.title.valueChanges, { initialValue: this.title.value });
    this.suggestions.preload();
  }

  async onShowQuery(value: string): Promise<void> {
    const text = value.trim();
    this.error.set(null);
    const version = ++this.queryVersion;
    const found = text.length < 2 || GUID.test(text) ? [] : await this.suggestions.suggest(text, 10, 'tvShow');
    if (version === this.queryVersion) {
      this.shows.set([...new Set(found.map(show => show.value))]);
    }
  }

  /** The title to send: undefined keeps the episode title on the server. */
  requestTitle(): string | undefined {
    const value = this.titleValue().trim();
    return value.length === 0 || value === (this.data.episodeTitle ?? '').trim() ? undefined : value;
  }

  private buildRequest(): EpisodeTvShowMoveRequest | null {
    const text = this.queryValue().trim();
    if (text.length === 0 || this.hasInvalidName()) {
      return null;
    }
    const title = this.requestTitle();
    const target: EpisodeTvShowMoveRequest = this.isShowId()
      ? { tvShowId: text.toLowerCase() }
      : this.isCreatingShow()
        ? { tvShowName: text, createShow: true, ...this.requestPublisher() }
        : { tvShowName: text };
    return title ? { ...target, title } : target;
  }

  private requestPublisher(): Pick<EpisodeTvShowMoveRequest, 'publisher'> {
    const publisher = this.publisherValue().trim();
    return publisher.length > 0 ? { publisher } : {};
  }

  /** Released inside the Indexer's look-back, so the next index may re-add it to the podcast (RPP #1068). */
  isRecentlyReleased(): boolean {
    return releasedWithinDays(this.data.release, RECENT_RELEASE_DAYS, new Date());
  }

  move(): void {
    const body = this.request();
    if (this.isSending() || !body) {
      return;
    }
    this.isSending.set(true);
    this.error.set(null);
    this.curationSubmit.postEpisodeToTvShow(this.data.podcastId, this.data.episodeId, body).subscribe({
      next: resp => {
        const outcome = resp.body as EpisodeTvShowMoveResponse | null;
        this.dialogRef.close({
          moved: true,
          tvShowId: outcome?.tvShowId ?? body.tvShowId,
          tvShowName: outcome?.tvShowName ?? body.tvShowName,
          episodeId: outcome?.episodeId ?? this.data.episodeId,
          createdShow: outcome?.createdShow ?? false
        });
      },
      error: (e: HttpErrorResponse) => {
        this.isSending.set(false);
        this.error.set(moveToTvShowErrorMessage(e));
        console.error(e);
      }
    });
  }

  cancel(): void {
    this.dialogRef.close({ moved: false });
  }
}

export function moveToTvShowErrorMessage(e: HttpErrorResponse): string {
  const body = e.error as { error?: string } | null | undefined;
  switch (e.status) {
    case 400:
      return body?.error ?? 'The episode cannot be moved to this TV show.';
    case 404:
      return body?.error ?? 'The episode or TV show was not found. Tick "Create a new TV show" to create it.';
    case 409:
      return body?.error ?? 'The episode cannot be moved to this TV show.';
    default:
      return 'An error occurred moving the episode. Sending again resumes an interrupted move.';
  }
}
