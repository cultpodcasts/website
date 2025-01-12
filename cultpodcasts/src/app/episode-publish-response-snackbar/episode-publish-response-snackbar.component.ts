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

  constructor(
    public snackBarRef: MatSnackBarRef<EpisodePublishResponseSnackbarComponent>,
    @Inject(MAT_SNACK_BAR_DATA) private data: PostEpisodeDialogResponseInterface,
    private messageBuilder: EpisodePublishResponseAdaptor
  ) {
    snackBarRef.onAction().subscribe(() => {
      console.log("EpisodePublishResponseSnackbarComponent", "action")
    });
  }

  ngOnInit() {
    if (this.data?.response?.failedTweetContent) {
      console.error(this.data.response.failedTweetContent)
    }

    if (this.data.noChange) {
      this.message = "No change made";
    } else if (this.data.response && this.data.expectation) {
      this.message = this.messageBuilder.createMessage(this.data.response, this.data.expectation);
    } else {
      this.message = "Unknown state";
    }
  }

  action() {
    this.snackBarRef.dismissWithAction()
  }

}
