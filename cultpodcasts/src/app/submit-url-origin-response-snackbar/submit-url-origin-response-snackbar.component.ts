import { Component, Inject } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { SubmitUrlOriginSuccessResponse } from '../submit-url-origin-success-response.interface';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { AddEpisodeDialogComponent } from '../add-episode-dialog/add-episode-dialog.component';
import { EditEpisodeDialogComponent } from '../edit-episode-dialog/edit-episode-dialog.component';
import { Router } from '@angular/router';
import { AddPodcastDialogComponent } from '../add-podcast-dialog/add-podcast-dialog.component';
import { MatIconModule } from '@angular/material/icon';
import { ApplePodcastsSvgComponent } from "../apple-podcasts-svg/apple-podcasts-svg.component";
import { EditEpisodeDialogResponse } from '../edit-episode-dialog-response.interface';

@Component({
  selector: 'app-submit-url-origin-response-snackbar',
  imports: [
    MatIconModule,
    ApplePodcastsSvgComponent
  ],
  templateUrl: './submit-url-origin-response-snackbar.component.html',
  styleUrl: './submit-url-origin-response-snackbar.component.sass'
})

export class SubmitUrlOriginResponseSnackbarComponent {
  actionText: string = "Ok";
  showReviewButton: boolean = false;
  existingPodcast: boolean;
  constructor(
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router,
    public snackBarRef: MatSnackBarRef<SubmitUrlOriginResponseSnackbarComponent>,
    @Inject(MAT_SNACK_BAR_DATA) public data: { existingPodcast: boolean, response: SubmitUrlOriginSuccessResponse }) {
    this.existingPodcast = data.existingPodcast;
    if (data.response.episode === "Created" || data.response.episode === "Enriched" || data.response.episode === "EpisodeAlreadyExists") {
      this.actionText = "Edit";
      this.showReviewButton = true;
      snackBarRef.onAction().subscribe(() => {
        this.editSubmittedEpisode(data.response.episodeId!, data.response.episode === "Created", data.response.podcast === "Created")
      });
    }
  }

  editSubmittedEpisode(id: string, isNewEpisode: boolean, isNewPodcast: boolean) {
    let dialogRef: MatDialogRef<AddEpisodeDialogComponent | EditEpisodeDialogComponent, any>;
    if (isNewEpisode) {
      dialogRef = this.dialog.open(AddEpisodeDialogComponent, {
        data: { episodeId: id, isNewPodcast: isNewPodcast },
        disableClose: true,
        autoFocus: true
      });
    } else {
      dialogRef = this.dialog.open<EditEpisodeDialogComponent, any, EditEpisodeDialogResponse>(EditEpisodeDialogComponent, {
        data: { episodeId: id },
        disableClose: true,
        autoFocus: true
      });
    }
    dialogRef.afterClosed().subscribe(async result => {
      if (result.isNewPodcast) {
        const podcastDialog = this.dialog.open(AddPodcastDialogComponent, {
          data: { podcastName: result.podcastName },
          disableClose: true,
          autoFocus: true
        });
        podcastDialog.afterClosed().subscribe(async podcastResult => {
          let message: string;
          if (podcastResult.noChange) {
            if (result.updated) {
              message = "Episode updated. Podcast unchanged";
            } else {
              message = "Episode unchanged. Podcast unchanged";
            }
          } else {
            if (result.updated) {
              message = "Episode updated. Podcast updated";
            } else {
              message = "Episode unchanged. Podcast updated";
            }
          }
          let podcastSnackBarRef = this.snackBar.open(message, "Review", { duration: 3000 });
          podcastSnackBarRef.onAction().subscribe(async () => await this.navigateToEpisodeReview(id));
        });
      } else {
        let snackBarRef: MatSnackBarRef<TextOnlySnackBar> | undefined;
        if (result.updated) {
          snackBarRef = this.snackBar.open("Episode updated", "Review", { duration: 10000 });
        } else if (result.noChange) {
          snackBarRef = this.snackBar.open("No change", "Review", { duration: 3000 });
        }
        if (snackBarRef) {
          snackBarRef.onAction().subscribe(async () => await this.navigateToEpisodeReview(id));
        }
      }
    });
  }

  action() {
    this.snackBarRef.dismissWithAction();
  }

  async review() {
    console.log("Navigating to episode review for episode ID:", this.data.response.episodeId);
    await this.navigateToEpisodeReview(this.data.response.episodeId!);
  }

  private async navigateToEpisodeReview(episodeId: string) {
    const id = JSON.stringify([episodeId]);
    await this.router.navigate(["/episodes", id])
  }
}