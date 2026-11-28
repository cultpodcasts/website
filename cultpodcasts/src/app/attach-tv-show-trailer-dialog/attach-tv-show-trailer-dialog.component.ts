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
import { firstValueFrom } from 'rxjs';
import { CurationSubmitService } from '../curation-submit.service';
import {
  AttachTvShowTrailerDialogClose,
  AttachTvShowTrailerDialogData,
  EpisodeTvShowTrailerAttachRequest,
  EpisodeTvShowTrailerAttachResponse
} from '../episode-tv-show-trailer-attach.interface';
import { SearchSuggestionsService } from '../search-suggestions.service';
import { attachTrailerErrorMessage, SuggestionQueryGuard, TrailerTarget, trailerTargetFromText } from '../trailer-target';
import { defaultPublisher, isGuid } from '../tv-show-target.util';

/**
 * Confirms and sends the curator "Attach as TV trailer/clip" command for one podcast episode (RPP #1412), the TV twin
 * of the film "Attach as trailer" dialog. The show is picked from the search-suggestions TV show names or a pasted show
 * id. The attach route takes an id, or `createShow` + a name, so a picked name is first resolved to its id with
 * `GET tvshow/{name}`; "Create a new TV show" sends the name with `createShow` and the server creates the show only when
 * no show has that name.
 */
@Component({
  selector: 'app-attach-tv-show-trailer-dialog',
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
  templateUrl: './attach-tv-show-trailer-dialog.component.html',
  styleUrl: './attach-tv-show-trailer-dialog.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttachTvShowTrailerDialogComponent {
  private readonly dialogRef = inject<MatDialogRef<AttachTvShowTrailerDialogComponent, AttachTvShowTrailerDialogClose>>(MatDialogRef);
  private readonly curationSubmit = inject(CurationSubmitService);
  private readonly suggestions = inject(SearchSuggestionsService);
  readonly data = inject<AttachTvShowTrailerDialogData>(MAT_DIALOG_DATA);

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
  readonly isShowId = computed(() => isGuid(this.queryValue().trim()));
  readonly hasInvalidName = computed(() => !this.isShowId() && this.queryValue().includes('/'));
  readonly isCreatingShow = computed(() => !this.isShowId() && this.createShowValue());
  /** The target, or null while there is no valid one. */
  readonly target = computed<TrailerTarget | null>(() => this.buildTarget());
  readonly isSending = signal(false);
  readonly error = signal<string | null>(null);
  private readonly queries = new SuggestionQueryGuard();

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
    const version = this.queries.begin();
    let found: { value: string }[] = [];
    if (text.length >= 2 && !isGuid(text)) {
      try {
        found = await this.suggestions.suggest(text, 10, 'tvShow');
      } catch (e) {
        console.error('TV show suggestions failed; a typed name can still be attached.', e);
      }
    }
    if (this.queries.isLatest(version)) {
      this.shows.set([...new Set(found.map(show => show.value))]);
    }
  }

  /** The title to send: undefined keeps the episode title on the server. */
  requestTitle(): string | undefined {
    const value = this.titleValue().trim();
    return value.length === 0 || value === (this.data.episodeTitle ?? '').trim() ? undefined : value;
  }

  private buildTarget(): TrailerTarget | null {
    return trailerTargetFromText(this.queryValue(), {
      create: this.isCreatingShow(),
      publisher: this.publisherValue()
    });
  }

  async attach(): Promise<void> {
    const target = this.target();
    if (this.isSending() || !target) {
      return;
    }
    this.isSending.set(true);
    this.error.set(null);
    const title = this.requestTitle();
    try {
      const request = await this.buildRequest(target, title);
      if (!request) {
        this.isSending.set(false);
        return;
      }
      const resp = await firstValueFrom(
        this.curationSubmit.postEpisodeAsTvShowTrailer(this.data.podcastId, this.data.episodeId, request));
      const outcome = resp.body as EpisodeTvShowTrailerAttachResponse | null;
      this.dialogRef.close({
        attached: true,
        tvShowId: outcome?.tvShowId ?? request.tvShowId,
        tvShowName: outcome?.tvShowName ?? (target.kind === 'id' ? undefined : target.name),
        ...(outcome?.showCreated ? { showCreated: true } : {})
      });
    } catch (e) {
      this.isSending.set(false);
      this.error.set(attachTrailerErrorMessage(e as HttpErrorResponse, 'tv'));
      console.error(e);
    }
  }

  /** The POST body. A picked name is resolved to the show's id first; null (with the error set) when it cannot be. */
  private async buildRequest(
    target: TrailerTarget,
    title: string | undefined
  ): Promise<EpisodeTvShowTrailerAttachRequest | null> {
    const withTitle = title ? { title } : {};
    switch (target.kind) {
      case 'id':
        return { tvShowId: target.id, ...withTitle };
      case 'create':
        return {
          createShow: true,
          tvShowName: target.name,
          ...(target.publisher ? { publisher: target.publisher } : {}),
          ...withTitle
        };
      case 'name': {
        try {
          const show = await firstValueFrom(this.curationSubmit.getCatalogueParent("tv", target.name));
          return { tvShowId: show.id, ...withTitle };
        } catch (e) {
          this.error.set(resolveTvShowErrorMessage(e as HttpErrorResponse));
          console.error(e);
          return null;
        }
      }
    }
  }

  cancel(): void {
    this.dialogRef.close({ attached: false });
  }
}

/** The snackbar after an attach: a created show holds only this trailer until episodes are indexed or moved in. */
export function attachedAsTvShowTrailerMessage(result: AttachTvShowTrailerDialogClose): string {
  return result.showCreated
    ? 'TV show created and episode attached as its trailer/clip.'
    : 'Attached as TV trailer/clip';
}

/** Why a picked show name could not be turned into an id (GET tvshow/{name}). */
export function resolveTvShowErrorMessage(e: HttpErrorResponse): string {
  switch (e.status) {
    case 404:
      return 'No TV show has this name. Tick "Create a new TV show" to create it.';
    case 409:
      return 'More than one TV show has this name. Paste the id of the TV show to attach to.';
    default:
      return 'The TV show could not be looked up. Nothing was attached.';
  }
}
