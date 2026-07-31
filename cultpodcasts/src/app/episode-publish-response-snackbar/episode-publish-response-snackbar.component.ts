import { Component, Inject, ViewEncapsulation, ChangeDetectionStrategy, signal } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { EpisodePublishResponseAdaptor } from '../episode-publish-response-adaptor';
import { MatDialog } from '@angular/material/dialog';
import { ManualTweetEpisodeDialogComponent } from '../manual-tweet-episode-dialog/manual-tweet-episode-dialog.component';
import { PostEpisodeDialogResponseWrapper } from '../post-episode-dialog-response-wrapper.interface';

@Component({
  selector: 'app-episode-publish-response-snackbar',
  imports: [],
  templateUrl: './episode-publish-response-snackbar.component.html',
  styleUrl: './episode-publish-response-snackbar.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class EpisodePublishResponseSnackbarComponent {
  readonly message = signal<string | undefined>(undefined);
  readonly showManualTweet = signal(false);

  constructor(
    public snackBarRef: MatSnackBarRef<EpisodePublishResponseSnackbarComponent>,
    @Inject(MAT_SNACK_BAR_DATA) private data: PostEpisodeDialogResponseWrapper,
    private messageBuilder: EpisodePublishResponseAdaptor,
    private dialog: MatDialog
  ) {
    snackBarRef.onAction().subscribe(() => { });
  }

  async ngOnInit(): Promise<any> {
    const response = this.data?.postEpisodeDialogResponse;
    if (!response || response.closed) {
      this.snackBarRef.dismiss();
      return;
    }
    if (response.response?.failedTweetContent) {
      console.error(response.response.failedTweetContent)
    }
    if (response.noChange) {
      this.message.set("No change made");
    } else if (response.response && response.expectation) {
      this.message.set(this.messageBuilder.createMessage(response.response, response.expectation));
      if (response.expectation.tweet && response.response.failedTweetContent) {
        if (!response.response.tweeted) {
          this.showManualTweet.set(true);
        }
      }
    } else {
      this.message.set("Unknown state");
    }
  }

  async manualTweet() {
    this.dialog.open<ManualTweetEpisodeDialogComponent, { tweet: string, episodeId: string, podcastId: string }, any>(
      ManualTweetEpisodeDialogComponent,
      {
        data: {
          tweet: this.data.postEpisodeDialogResponse.response!.failedTweetContent!,
          episodeId: this.data.episodeId,
          podcastId: this.data.podcastId
        },
        disableClose: true, autoFocus: true
      });
    this.action();
  }

  action() {
    this.snackBarRef.dismissWithAction()
  }
}
