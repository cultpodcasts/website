import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EpisodePost } from '../episode-post.interface';
import { CurationSubmitService } from '../curation-submit.service';

@Component({
  selector: 'app-edit-episode-send',
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './edit-episode-send.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './edit-episode-send.component.sass'
})
export class EditEpisodeSendComponent {
  readonly isSending = signal(true);
  readonly sendError = signal(false);

  constructor(
    private dialogRef: MatDialogRef<EditEpisodeSendComponent>,
    private curationSubmit: CurationSubmitService) {
  }

  public submit(podcastId: string, episodeId: string, changes: EpisodePost) {
    this.curationSubmit.postEpisode(podcastId, episodeId, changes).subscribe({
      next: resp => {
        this.dialogRef.close({ updated: true, response: resp });
      },
      error: e => {
        this.isSending.set(false);
        this.sendError.set(true);
        console.error(e);
      }
    });
  }

  close() {
    this.dialogRef.close({ updated: false });
  }
}
