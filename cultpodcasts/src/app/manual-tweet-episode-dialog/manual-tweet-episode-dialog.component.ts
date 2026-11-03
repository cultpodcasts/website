import { Component, Inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EpisodeUpdateService } from '../episode-update.service';

@Component({
  selector: 'app-manual-tweet-episode-dialog',
  imports: [MatDialogModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './manual-tweet-episode-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './manual-tweet-episode-dialog.component.sass'
})
export class ManualTweetEpisodeDialogComponent {
  readonly isInError = signal(false);
  readonly isMarking = signal(false);
  episodeId: string;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { tweet: string, episodeId: string, podcastId?: string },
    private dialogRef: MatDialogRef<ManualTweetEpisodeDialogComponent, any>,
    private episodeUpdate: EpisodeUpdateService
  ) {
    this.episodeId = data.episodeId;
  }

  async ngOnInit(): Promise<any> {
  }

  close() {
    this.dialogRef.close({ closed: true });
  }

  createLink(): string {
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(this.data.tweet)}`;
  }

  /**
   * Mark tweeted via EpisodeUpdateService so Film / News / TV use playable PATCH routes
   * (not podcast-only PATCH /episode/{podcastId}/{episodeId}).
   */
  async markAsTweeted() {
    if (this.isMarking()) {
      return;
    }
    this.isMarking.set(true);
    this.isInError.set(false);
    try {
      const episode = await this.episodeUpdate.fetchEpisode(this.episodeId);
      await this.episodeUpdate.markTweeted(episode);
      this.dialogRef.close({ updated: true });
    } catch {
      this.isInError.set(true);
    } finally {
      this.isMarking.set(false);
    }
  }
}
