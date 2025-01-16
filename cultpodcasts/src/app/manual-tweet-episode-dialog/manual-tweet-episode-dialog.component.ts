import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EditEpisodeSendComponent } from '../edit-episode-send/edit-episode-send.component';
import { EpisodeChangeResponse } from '../episode-change-response.interface';

@Component({
  selector: 'app-manual-tweet-episode-dialog',
  imports: [MatDialogModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './manual-tweet-episode-dialog.component.html',
  styleUrl: './manual-tweet-episode-dialog.component.sass'
})
export class ManualTweetEpisodeDialogComponent {
  isInError: boolean = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { tweet: string, episodeId: string },
    private dialogRef: MatDialogRef<ManualTweetEpisodeDialogComponent, any>,
    private dialog: MatDialog
  ) {
  }

  async ngOnInit(): Promise<any> {
  }

  close() {
    this.dialogRef.close({ closed: true });
  }

  createLink(): string {
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(this.data.tweet)}`;
  }

  markAsTweeted() {
    const dialogRef = this.dialog.open<EditEpisodeSendComponent, any, { updated: boolean, response: EpisodeChangeResponse }>(EditEpisodeSendComponent, { disableClose: true, autoFocus: true });
    dialogRef.componentInstance.submit(this.data.episodeId, { tweeted: true });
    dialogRef.afterClosed().subscribe(async result => {
      if (result && result.updated) {
        this.dialogRef.close({ updated: true, response: result.response });
      } else {
        this.isInError = true;
      }
    });
  }
}
