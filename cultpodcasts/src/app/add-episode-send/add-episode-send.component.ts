import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EpisodePost } from '../episode-post.interface';
import { CurationSubmitService } from '../curation-submit.service';

@Component({
  selector: 'app-add-episode-send',
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './add-episode-send.component.html',
  styleUrl: './add-episode-send.component.sass'
})
export class AddEpisodeSendComponent {
  isSending: boolean = true;
  sendError: boolean = false;

  constructor(
    private dialogRef: MatDialogRef<AddEpisodeSendComponent>,
    private curationSubmit: CurationSubmitService) {
  }

  public submit(podcastId: string, episodeId: string, changes: EpisodePost) {
    this.curationSubmit.postEpisode(podcastId, episodeId, changes).subscribe({
      next: () => {
        this.dialogRef.close({ updated: true });
      },
      error: e => {
        this.isSending = false;
        this.sendError = true;
        console.error(e);
      }
    });
  }

  close() {
    this.dialogRef.close({ updated: false });
  }
}
