import { Component, Inject, ViewEncapsulation } from '@angular/core';
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
  encapsulation: ViewEncapsulation.None
})
export class EpisodePublishResponseSnackbarComponent {
  message: string | undefined;
  failedTweet: string | undefined;
  showManualTweet: boolean = false;

  constructor(
    public snackBarRef: MatSnackBarRef<EpisodePublishResponseSnackbarComponent>,
    @Inject(MAT_SNACK_BAR_DATA) private data: PostEpisodeDialogResponseWrapper,
    private messageBuilder: EpisodePublishResponseAdaptor,
    private dialog: MatDialog
  ) {
    snackBarRef.onAction().subscribe(() => { });
  }

  async ngOnInit(): Promise<any> {
    if (this.data?.postEpisodeDialogResponse.response?.failedTweetContent) {
      console.error(this.data.postEpisodeDialogResponse.response.failedTweetContent)
    }
    if (this.data.postEpisodeDialogResponse.noChange) {
      this.message = "No change made";
    } else if (this.data.postEpisodeDialogResponse.response && this.data.postEpisodeDialogResponse.expectation) {
      this.message = this.messageBuilder.createMessage(this.data.postEpisodeDialogResponse.response, this.data.postEpisodeDialogResponse.expectation);
      if (this.data.postEpisodeDialogResponse.expectation.tweet && this.data.postEpisodeDialogResponse.response.failedTweetContent) {
        if (!this.data.postEpisodeDialogResponse.response.tweeted) {
          this.showManualTweet = true;
        }
      }
    } else {
      this.message = "Unknown state";
    }
  }

  async manualTweet() {
    this.dialog.open<ManualTweetEpisodeDialogComponent, { tweet: string, episodeId: string }, any>(
      ManualTweetEpisodeDialogComponent,
      {
        data: {
          tweet: this.data.postEpisodeDialogResponse.response!.failedTweetContent!,
          episodeId: this.data.episodeId
        }
      });
    this.action();
  }

  action() {
    this.snackBarRef.dismissWithAction()
  }
}
