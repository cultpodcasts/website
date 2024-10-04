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
import { MatDialog } from "@angular/material/dialog";
import { SubmitPodcastComponent } from '../submit-podcast/submit-podcast.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SendPodcastComponent } from '../send-podcast/send-podcast.component';
import { IShare } from '../IShare';
import { ShareMode } from "../ShareMode";
import { EditEpisodeDialogComponent } from '../edit-episode-dialog/edit-episode-dialog.component';
import { SubmitDialogResponse } from '../submit-url-origin-response';
import { EditSubjectDialogComponent } from '../edit-subject-dialog/edit-subject-dialog.component';
import { OutgoingEpisodesSendComponent } from '../outgoing-episodes-send/outgoing-episodes-send.component';
import { FirstLoginNoticeComponent } from '../first-login-notice/first-login-notice.component';

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
            let edit: boolean = false;
            if (result.originResponse.success.episode === "Created") {
              episode = "Episode created.";
              edit = true;
            } else if (result.originResponse.success.episode === "Enriched") {
              episode = "Episode enriched.";
              edit = true;
            } else if (result.originResponse.success.episode === "Ignored") {
              episode = "Episode ignored.";
            } else {
              episode = "Episode not created.";
            }
            let podcast = "";
            if (result.originResponse.success.podcast === "Created") {
              podcast = "Podcast created.";
            } else if (result.originResponse.success.podcast === "Enriched") {
              podcast = "Podcast enriched.";
            } else if (result.originResponse.success.podcast === "Ignored") {
              podcast = "Podcast ignored.";
            } else if (result.originResponse.success.podcast === "PodcastRemoved") {
              podcast = "Podcast Removed.";
            }
            let snackBarRef = this.snackBar.open(`Podcast Sent direct to database. ${podcast} ${episode}`, edit ? "Edit" : "Ok", { duration: 10000 });

            if (edit) {
              snackBarRef.onAction().subscribe(() => {
                this.edit(result.originResponse!.success!.episodeId!)
              });
            }
          } else {
            let snackBarRef = this.snackBar.open('Podcast Sent!', "Ok", { duration: 3000 });
          }
        }
      });
    await dialog.componentInstance.submit(share);
  }

  edit(id: string) {
    const dialogRef = this.dialog.open(EditEpisodeDialogComponent, {
      data: { episodeId: id },
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result.updated) {
        let snackBarRef = this.snackBar.open("Episode updated", "Ok", { duration: 10000 });
      } else if (result.noChange) {
        let snackBarRef = this.snackBar.open("No change", "Ok", { duration: 3000 });
      }
    });
  }

  openReviewOutgoing() {
    this.router.navigate(["/outgoingEpisodes"], { onSameUrlNavigation: 'reload' })
  }
}
