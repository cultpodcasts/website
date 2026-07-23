import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AddPodcastPost } from '../add-podcast-post.interface';
import { CurationSubmitService } from '../curation-submit.service';

@Component({
  selector: 'app-add-podcast-send',
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './add-podcast-send.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './add-podcast-send.component.sass'
})
export class AddPodcastSendComponent {
  isSending: boolean = true;
  sendError: boolean = false;

  constructor(
    private dialogRef: MatDialogRef<AddPodcastSendComponent>,
    private curationSubmit: CurationSubmitService) {
  }

  public submit(podcastId: string, changes: AddPodcastPost) {
    this.curationSubmit.putPodcast(podcastId, changes).subscribe({
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
