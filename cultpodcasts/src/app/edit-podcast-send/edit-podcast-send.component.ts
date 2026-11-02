import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EditPodcastPost } from "../edit-podcast-post.interface";
import { CurationSubmitService } from '../curation-submit.service';
import { youtubePlaylistEditError } from '../youtube-playlist-edit-error';

@Component({
  selector: 'app-edit-podcast-send',
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './edit-podcast-send.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './edit-podcast-send.component.sass'
})
export class EditPodcastSendComponent {
  readonly isSending = signal(true);
  readonly sendError = signal(false);
  readonly errorMessage = signal('An error occured updating podcast');
  readonly retryable = signal(false);
  private podcastId: string | undefined;
  private changes: EditPodcastPost | undefined;

  constructor(
    private dialogRef: MatDialogRef<EditPodcastSendComponent>,
    private curationSubmit: CurationSubmitService) {
  }

  public submit(podcastId: string, changes: EditPodcastPost) {
    this.podcastId = podcastId;
    this.changes = changes;
    this.send(podcastId, changes);
  }

  /** Re-posts the same change when the Api said the playlist ownership check was retryable. */
  retry() {
    if (!this.podcastId || !this.changes || !this.retryable()) {
      return;
    }
    this.send(this.podcastId, this.changes);
  }

  private send(podcastId: string, changes: EditPodcastPost) {
    this.isSending.set(true);
    this.sendError.set(false);
    this.retryable.set(false);
    this.errorMessage.set('An error occured updating podcast');
    this.curationSubmit.patchPodcast(podcastId, changes).subscribe({
      next: resp => {
        this.dialogRef.close({ updated: true, response: resp.body });
      },
      error: e => {
        this.isSending.set(false);
        this.sendError.set(true);
        const playlist = youtubePlaylistEditError(e);
        if (playlist) {
          this.errorMessage.set(playlist.message);
          this.retryable.set(playlist.retryable);
        }
        console.error(e);
      }
    });
  }

  close() {
    this.dialogRef.close({ updated: false });
  }
}
