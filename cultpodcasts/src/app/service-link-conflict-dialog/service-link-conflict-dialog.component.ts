import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

/** One service whose stored link differs from the submitted one (RPP #1416 `serviceLinkConflict.links`). */
export interface ServiceLinkConflictLink {
  service: string;
  storedUrl?: string | null;
  submittedUrl?: string | null;
}

/** RPP #1416: `POST /submit` 200 body `serviceLinkConflict`. Nothing has been written yet. */
export interface ServiceLinkConflictPrompt {
  episodeId: string;
  /** RPP #1484: the stored episode's podcast, so the dialog can link the stored episode. */
  podcastId?: string | null;
  episodeTitle: string;
  episodeRelease: string;
  links: ServiceLinkConflictLink[];
}

/**
 * overwrite = the stored episode takes the submitted links; its old links move to a new episode.
 * create-new = add the submitted item as a separate episode. cancel = write nothing.
 */
export type ServiceLinkConflictAnswer = 'overwrite' | 'create-new' | 'cancel';

const SERVICE_NAMES: Record<string, string> = {
  spotify: 'Spotify',
  apple: 'Apple Podcasts',
  youtube: 'YouTube'
};

@Component({
  selector: 'app-service-link-conflict-dialog',
  imports: [MatDialogModule, MatButtonModule, DatePipe],
  templateUrl: './service-link-conflict-dialog.component.html',
  styleUrl: './service-link-conflict-dialog.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ServiceLinkConflictDialogComponent {
  readonly data = inject<ServiceLinkConflictPrompt>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ServiceLinkConflictDialogComponent, ServiceLinkConflictAnswer>);

  /** RPP #1484: curator review page for the stored episode (opens in a new tab), when its podcast is known. */
  get storedEpisodeLink(): string | null {
    if (!this.data.podcastId) {
      return null;
    }
    return `/episodes/${encodeURIComponent(JSON.stringify([`${this.data.podcastId}/${this.data.episodeId}`]))}`;
  }

  serviceName(service: string): string {
    return SERVICE_NAMES[service.toLowerCase()] ?? service;
  }

  choose(answer: ServiceLinkConflictAnswer) {
    this.dialogRef.close(answer);
  }
}
