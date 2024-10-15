import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { FeatureSwtichService } from '../FeatureSwitchService';
import { isPlatformBrowser, NgIf, AsyncPipe } from '@angular/common';
import { FeatureSwitch } from '../FeatureSwitch';
import { MatIconModule } from "@angular/material/icon";
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { SiteService } from '../SiteService';
import { Router, RouterLink } from '@angular/router';
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { SubmitPodcastComponent } from '../submit-podcast/submit-podcast.component';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { SendPodcastComponent } from '../send-podcast/send-podcast.component';
import { IShare } from '../IShare';
import { ShareMode } from "../ShareMode";
import { AddEpisodeDialogComponent } from '../add-episode-dialog/add-episode-dialog.component';
import { EditEpisodeDialogComponent } from '../edit-episode-dialog/edit-episode-dialog.component';
import { SubmitDialogResponse } from '../submit-url-origin-response';
import { EditSubjectDialogComponent } from '../edit-subject-dialog/edit-subject-dialog.component';
import { FirstLoginNoticeComponent } from '../first-login-notice/first-login-notice.component';
import { RunSearchIndexerComponent } from '../run-search-indexer/run-search-indexer.component';
import { PublishHomepageComponent } from '../publish-homepage/publish-homepage.component';
import { AddTermComponent } from '../add-term/add-term.component';
import { EditPodcastDialogComponent } from '../edit-podcast-dialog/edit-podcast-dialog.component';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [MatToolbarModule, MatIconModule, MatMenuModule, RouterLink, NgIf, AsyncPipe],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.sass',
  host: { ngSkipHydration: 'true' }
})
export class ToolbarComponent {
  public FeatureSwitch = FeatureSwitch;
  isBrowser: boolean;

  constructor(
    protected siteService: SiteService,
    protected auth: AuthServiceWrapper,
    protected featureSwtichService: FeatureSwtichService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    @Inject(PLATFORM_ID) private platformId: any,
    private router: Router
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  login() {
    if (localStorage.getItem("hasLoggedIn")) {
      this.auth.authService.loginWithRedirect();
    } else {
      this.dialog
        .open(FirstLoginNoticeComponent, { disableClose: true, autoFocus: true })
        .afterClosed()
        .subscribe(async result => {
          if (result?.continue) {
            this.auth.authService.loginWithRedirect();;
          }
        });
    }
  }

  logout() {
    this.auth.authService.logout();
  }

  async openSubmitPodcast() {
    this.dialog
      .open(SubmitPodcastComponent, { disableClose: true, autoFocus: true })
      .afterClosed()
      .subscribe(async result => {
        if (result?.url) {
          await this.sendPodcast({ url: result.url, podcastId: result.podcast?.id, podcastName: undefined, shareMode: ShareMode.Text });
        }
      });
  }

  openSubmitSubject() {
    const dialogRef = this.dialog.open(EditSubjectDialogComponent, {
      data: { create: true },
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result.updated) {
        let snackBarRef = this.snackBar.open("Subject created", "Edit", { duration: 10000 });
        snackBarRef.onAction().subscribe(() => {
          const dialogRef = this.dialog.open(EditSubjectDialogComponent, {
            data: { subjectName: result.subjectName },
            disableClose: true,
            autoFocus: true
          });
        });
      } else if (result.conflict) {
        let snackBarRef = this.snackBar.open(`Subject conflicts with '${result.conflict}'`, "Edit", { duration: 10000 });
        snackBarRef.onAction().subscribe(() => {
          const dialogRef = this.dialog.open(EditSubjectDialogComponent, {
            data: { subjectName: result.conflict },
            disableClose: true,
            autoFocus: true
          });
        });
      } else if (result.noChange) {
        let snackBarRef = this.snackBar.open("No change", "Ok", { duration: 3000 });
      }
    });
  }

  async sendPodcast(share: IShare) {
    const dialog = this.dialog.open<SendPodcastComponent, any, SubmitDialogResponse>(SendPodcastComponent, { disableClose: true, autoFocus: true });
    dialog
      .afterClosed()
      .subscribe(result => {
        if (result && result.submitted) {
          if (result.originResponse?.success != null) {
            let episode: string;
            let editExisting: boolean = false;
            let editNew: boolean = false;
            let newPodcast: boolean = false;
            if (result.originResponse.success.episode === "Created") {
              episode = "Episode created.";
              editNew = true;
            } else if (result.originResponse.success.episode === "Enriched") {
              episode = "Episode enriched.";
              editExisting = true;
            } else if (result.originResponse.success.episode === "Ignored") {
              episode = "Episode ignored.";
            } else {
              episode = "Episode not created.";
            }
            let podcast = "";
            if (result.originResponse.success.podcast === "Created") {
              podcast = "Podcast created.";
              newPodcast = true;
            } else if (result.originResponse.success.podcast === "Enriched") {
              podcast = "Podcast enriched.";
            } else if (result.originResponse.success.podcast === "Ignored") {
              podcast = "Podcast ignored.";
            } else if (result.originResponse.success.podcast === "PodcastRemoved") {
              podcast = "Podcast Removed.";
            }
            let snackBarRef = this.snackBar.open(`Podcast Sent direct to database. ${podcast} ${episode}`, editNew || editExisting ? "Edit" : "Ok", { duration: 10000 });

            if (editNew || editExisting) {
              snackBarRef.onAction().subscribe(() => {
                this.editSubmittedEpisode(result.originResponse!.success!.episodeId!, editNew, newPodcast)
              });
            }
          } else {
            let snackBarRef = this.snackBar.open('Podcast Sent!', "Ok", { duration: 3000 });
          }
        }
      });
    await dialog.componentInstance.submit(share);
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
      dialogRef = this.dialog.open(EditEpisodeDialogComponent, {
        data: { episodeId: id },
        disableClose: true,
        autoFocus: true
      });
    }
    dialogRef.afterClosed().subscribe(async result => {
      if (result.isNewPodcast) {
        const podcastDialog = this.dialog.open(EditPodcastDialogComponent, {
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
          podcastSnackBarRef.onAction().subscribe(() => {
            const episodeId = JSON.stringify([id]);
            this.router.navigate(["/episodes", episodeId])
          });
        });
      } else {
        let snackBarRef: MatSnackBarRef<TextOnlySnackBar> | undefined;
        if (result.updated) {
          snackBarRef = this.snackBar.open("Episode updated", "Review", { duration: 10000 });
        } else if (result.noChange) {
          snackBarRef = this.snackBar.open("No change", "Review", { duration: 3000 });
        }
        if (snackBarRef) {
          snackBarRef.onAction().subscribe(() => {
            const episodeId = JSON.stringify([id]);
            this.router.navigate(["/episodes", episodeId])
          });
        }
      }
    });
  }

  openReviewOutgoing() {
    this.router.navigate(["/outgoingEpisodes"], { onSameUrlNavigation: 'reload' })
  }

  runSearchIndexer() {
    const dialogRef = this.dialog.open(RunSearchIndexerComponent, {
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      let snackBarRef = this.snackBar.open(result.replace(/([A-Z])/g, ' $1').trim(), "Ok", { duration: 10000 });
    });
  }

  publishHomepage() {
    const dialogRef = this.dialog.open(PublishHomepageComponent, {
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      let snackBarRef = this.snackBar.open(result.replace(/([A-Z])/g, ' $1').trim(), "Ok", { duration: 10000 });
    });
  }

  addTerm() {
    const dialogRef = this.dialog.open(AddTermComponent, {
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result.updated) {
        let snackBarRef = this.snackBar.open(`Term '${result.term}' added`, "Ok", { duration: 10000 });
      }
    });

  }

}
