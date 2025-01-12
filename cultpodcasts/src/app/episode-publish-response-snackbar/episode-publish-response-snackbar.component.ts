import { Component, Inject } from '@angular/core';
import { PostEpisodeDialogResponseInterface } from '../post-episode-dialog-response.interface';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { EpisodePublishResponseAdaptor } from '../episode-publish-response-adaptor';

@Component({
  selector: 'app-episode-publish-response-snackbar',
  imports: [],
  templateUrl: './episode-publish-response-snackbar.component.html',
  styleUrl: './episode-publish-response-snackbar.component.sass'
})
export class EpisodePublishResponseSnackbarComponent {
  message: string | undefined;
  failedTweet: string | undefined;
  showCopyTweet: boolean = false;

  constructor(
    public snackBarRef: MatSnackBarRef<EpisodePublishResponseSnackbarComponent>,
    @Inject(MAT_SNACK_BAR_DATA) private data: PostEpisodeDialogResponseInterface,
    private messageBuilder: EpisodePublishResponseAdaptor
  ) {
    snackBarRef.onAction().subscribe(() => {
      console.log("EpisodePublishResponseSnackbarComponent", "action")
    });
  }

  async ngOnInit(): Promise<any> {
    if (this.data?.response?.failedTweetContent) {
      console.error(this.data.response.failedTweetContent)
    }
    if (this.data.noChange) {
      this.message = "No change made";
    } else if (this.data.response && this.data.expectation) {
      this.message = this.messageBuilder.createMessage(this.data.response, this.data.expectation);
      if (this.data.expectation.tweet && this.data.response.failedTweetContent) {
        if (!this.data.response.tweeted) {
          this.showCopyTweet = true;
        }
      }
    } else {
      this.message = "Unknown state";
    }
  }

  async copyTweet() {
    await navigator.clipboard.writeText(this.data.response!.failedTweetContent!)
    this.action();
  }

  action() {
    this.snackBarRef.dismissWithAction()
  }
}
