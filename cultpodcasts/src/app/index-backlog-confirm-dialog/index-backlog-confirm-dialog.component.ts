import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';
import { AUTH_SCOPE } from '../auth.interceptor';
import { IndexBacklogPreviewResponse } from '../index-podcast-response.interface';

export type IndexBacklogConfirmDialogData = { podcastName: string };

/**
 * Admin confirmation before a podcast backlog index. Asks the dry-run
 * `GET /podcast/index/{name}/backlog/preview` how many episodes the full walk would ingest and shows the count.
 * Closes `true` only when the admin picks Index backlog; Cancel, Close and Escape close without a result.
 * Nothing is indexed here (cultpodcasts/RedditPodcastPoster#1433).
 */
@Component({
  selector: 'app-index-backlog-confirm-dialog',
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './index-backlog-confirm-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IndexBacklogConfirmDialogComponent {
  private readonly http = inject(HttpClient);
  private readonly dialogRef = inject<MatDialogRef<IndexBacklogConfirmDialogComponent, boolean>>(MatDialogRef);
  private readonly data = inject<IndexBacklogConfirmDialogData>(MAT_DIALOG_DATA);

  readonly podcastName = this.data.podcastName;
  readonly isCounting = signal(true);
  readonly preview = signal<IndexBacklogPreviewResponse | null>(null);
  readonly errorMessage = signal<string | null>(null);

  /** True when the count came back and at least one episode would be ingested. */
  readonly canConfirm = computed(() => (this.preview()?.newEpisodeCount ?? 0) > 0);

  /** "12 new episodes" / "1 new episode". */
  readonly newEpisodesLabel = computed(() => {
    const n = this.preview()?.newEpisodeCount ?? 0;
    return `${n} new episode${n === 1 ? '' : 's'}`;
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const url = new URL(
      `/podcast/index/${encodeURIComponent(this.podcastName)}/backlog/preview`,
      environment.api
    ).toString();
    try {
      const preview = await firstValueFrom(
        this.http.get<IndexBacklogPreviewResponse>(url, {
          context: new HttpContext().set(AUTH_SCOPE, 'admin')
        })
      );
      this.preview.set(preview);
    } catch (e) {
      this.errorMessage.set(previewErrorMessage(e));
    } finally {
      this.isCounting.set(false);
    }
  }

  confirm() {
    this.dialogRef.close(true);
  }

  cancel() {
    this.dialogRef.close(false);
  }
}

/** Words for a failed dry run: the admin must know whether to retry or give up. */
export function previewErrorMessage(e: unknown): string {
  const status = e instanceof HttpErrorResponse ? e.status : undefined;
  switch (status) {
    case 400:
      return 'This podcast cannot be indexed: it is removed or not set to index all episodes.';
    case 404:
      return 'Podcast not found.';
    case 504:
      return 'Counting the episodes ran out of time. Try again later.';
    default:
      return 'The episodes could not be counted. Try again later.';
  }
}