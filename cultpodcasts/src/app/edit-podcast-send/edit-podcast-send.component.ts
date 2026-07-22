import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EditPodcastPost } from "../edit-podcast-post.interface";
import { CurationSubmitService } from '../curation-submit.service';

@Component({
  selector: 'app-edit-podcast-send',
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './edit-podcast-send.component.html',
  styleUrl: './edit-podcast-send.component.sass'
})
export class EditPodcastSendComponent {
  isSending: boolean = true;
  sendError: boolean = false;

  constructor(
    private dialogRef: MatDialogRef<EditPodcastSendComponent>,
    private curationSubmit: CurationSubmitService) {
  }

  public submit(podcastId: string, changes: EditPodcastPost) {
    this.curationSubmit.postPodcast(podcastId, changes).subscribe({
      next: resp => {
        this.dialogRef.close({ updated: true, response: resp.body });
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
