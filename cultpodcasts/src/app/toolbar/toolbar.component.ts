import { Component } from '@angular/core';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { FeatureSwtichService } from '../FeatureSwitchService';
import { NgIf, AsyncPipe } from '@angular/common';
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
import { SubmitDialogResponse } from '../submit-url-origin-response';
import { EditSubjectDialogComponent } from '../edit-subject-dialog/edit-subject-dialog.component';
import { FirstLoginNoticeComponent } from '../first-login-notice/first-login-notice.component';
import { RunSearchIndexerComponent } from '../run-search-indexer/run-search-indexer.component';
import { PublishHomepageComponent } from '../publish-homepage/publish-homepage.component';
import { AddTermComponent } from '../add-term/add-term.component';
import { IndexerState } from '../indexer-state';
import { SubmitUrlOriginResponseSnackbarComponent } from '../submit-url-origin-response-snackbar/submit-url-origin-response-snackbar.component';

@Component({
  selector: 'app-toolbar',
  imports: [MatToolbarModule, MatIconModule, MatMenuModule, RouterLink, NgIf, AsyncPipe],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.sass'
})
export class ToolbarComponent {
  public FeatureSwitch = FeatureSwitch;
  authRoles: string[] = [];

  constructor(
    protected siteService: SiteService,
    protected auth: AuthServiceWrapper,
    protected featureSwtichService: FeatureSwtichService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router
  ) {
    auth.roles.subscribe(roles => this.authRoles = roles);
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
            let snackBarRef = this.snackBar.openFromComponent(SubmitUrlOriginResponseSnackbarComponent, { duration: 10000, data: { existingPodcast: false, response: result.originResponse?.success } });
          } else {
            let snackBarRef = this.snackBar.open('Podcast Sent!', "Ok", { duration: 3000 });
          }
        }
      });
    await dialog.componentInstance.submit(share);
  }

  openReviewOutgoing() {
    this.router.navigate(["/outgoingEpisodes"], { onSameUrlNavigation: 'reload' })
  }

  runSearchIndexer() {
    const dialogRef = this.dialog.open<RunSearchIndexerComponent, any, { message?: string, indexerState?: IndexerState }>(RunSearchIndexerComponent, {
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      let message: string;
      if (result?.message) {
        message = result.message;
      } else {
        if (result?.indexerState?.state == "Executed") {
          message = "Index Success";
        } else if (result?.indexerState?.state == "AlreadyRunning" || result?.indexerState?.state == "TooManyRequests") {
          var status = result.indexerState.state.replace(/([A-Z])/g, ' $1').trim();
          if (result.indexerState.nextRun) {
            message = `${status}. Run Index in ${this.timespanToDisplay(result.indexerState.nextRun)}`;
          } else if (result.indexerState.lastRan) {
            message = `${status}. Index last executed ${this.timespanToDisplay(result.indexerState.lastRan)} ago`;
          } else {
            message = status;
          }
        } else if (result?.indexerState?.state == "Failure") {
          message = "Index Failure";
        } else {
          message = "Unknown Failure.";
        }
      }
      let snackBarRef = this.snackBar.open(message, "Ok", { duration: 10000 });
    });
  }

  timespanToDisplay(timespan: string): string {
    // 00:02:43.7817276
    var timeComponent = timespan.split(".")[0];
    var components = timeComponent.split(":");
    let result = "";
    if (components[0] != "00") {
      result += `${parseInt(components[0])}:`;
    }
    if (components[1] != "00") {
      if (result == "") {
        result += `${parseInt(components[1])}:`;
      } else {
        result += `${components[1]}:`;
      }
    }
    if (result == "") {
      result = `${parseInt(components[2])} seconds`;
    } else {
      result += components[2];
    }
    return result;
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
