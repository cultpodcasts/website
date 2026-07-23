import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { FeatureSwitchService } from '../feature-switch-service';
import { AsyncPipe } from '@angular/common';
import { FeatureSwitch } from '../feature-switch.enum';
import { MatIconModule } from "@angular/material/icon";
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { SiteService } from '../site.service';
import { Router, RouterLink } from '@angular/router';
import { MatDialog } from "@angular/material/dialog";
import { SubmitPodcastComponent } from '../submit-podcast/submit-podcast.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SendPodcastComponent } from '../send-podcast/send-podcast.component';
import { ShareMode } from "../share-mode.enum";
import { SubmitDialogResponse } from '../submit-dialog-response.interface';
import { EditSubjectDialogComponent } from '../edit-subject-dialog/edit-subject-dialog.component';
import { FirstLoginNoticeComponent } from '../first-login-notice/first-login-notice.component';
import { RunSearchIndexerComponent } from '../run-search-indexer/run-search-indexer.component';
import { PublishHomepageComponent } from '../publish-homepage/publish-homepage.component';
import { AddTermComponent } from '../add-term/add-term.component';
import { DiscoveryScheduleComponent } from '../discovery-schedule/discovery-schedule.component';
import { IndexerState } from '../indexer-state.interface';
import { SubmitUrlOriginResponseSnackbarComponent } from '../submit-url-origin-response-snackbar/submit-url-origin-response-snackbar.component';
import { MatBadgeModule } from '@angular/material/badge';
import { Share } from '../share.interface';
import { DiscoveryInfoService } from '../discovery-info.service';
import { authRedirectUri } from '../auth-redirect-uri';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-toolbar',
  imports: [
    MatToolbarModule,
    MatIconModule,
    MatMenuModule,
    RouterLink,
    AsyncPipe,
    MatBadgeModule
  ],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToolbarComponent {
  public FeatureSwitch = FeatureSwitch;
  protected auth = inject(AuthServiceWrapper);
  protected discoveryInfoService = inject(DiscoveryInfoService);
  protected siteService = inject(SiteService);
  protected featureSwitchService = inject(FeatureSwitchService);
  protected readonly authRoles = toSignal(this.auth.roles, { initialValue: [] as string[] });
  protected readonly disoveryInfo = toSignal(this.discoveryInfoService.discoveryInfo, { initialValue: undefined });

  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  login() {
    if (localStorage.getItem("hasLoggedIn")) {
      this.auth.authService.loginWithRedirect();
    } else {
      this.dialog
        .open(FirstLoginNoticeComponent, { disableClose: true, autoFocus: true })
        .afterClosed()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(async result => {
          if (result?.continue) {
            this.auth.authService.loginWithRedirect();;
          }
        });
    }
  }

  onSiteClick() {
    this.siteService.setQuery('');
    const path = this.router.url.split('?')[0];
    if (path === '/' || path === '') {
      this.siteService.requestHomepageRefresh();
    }
  }

  logout() {
    this.auth.authService.logout({
      logoutParams: {
        returnTo: authRedirectUri(environment.assetHost)
      }
    });
  }

  async openSubmitPodcast() {
    this.dialog
      .open(SubmitPodcastComponent, { disableClose: true, autoFocus: true })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
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
      autoFocus: true,
      width: '90%'
    });
    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async result => {
        if (result.updated) {
          const snackBarRef = this.snackBar.open("Subject created", "Edit", { duration: 10000 });
          snackBarRef.onAction()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
              this.dialog.open(EditSubjectDialogComponent, {
                data: { subjectName: result.subjectName },
                disableClose: true,
                autoFocus: true,
                width: '90%'
              });
            });
        } else if (result.conflict) {
          const snackBarRef = this.snackBar.open(`Subject conflicts with '${result.conflict}'`, "Edit", { duration: 10000 });
          snackBarRef.onAction()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
              this.dialog.open(EditSubjectDialogComponent, {
                data: { subjectName: result.conflict },
                disableClose: true,
                autoFocus: true,
                width: '90%'
              });
            });
        } else if (result.noChange) {
          this.snackBar.open("No change", "Ok", { duration: 3000 });
        }
      });
  }

  async sendPodcast(share: Share) {
    const dialog = this.dialog.open<SendPodcastComponent, any, SubmitDialogResponse>(SendPodcastComponent, { disableClose: true, autoFocus: true });
    dialog
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result && result.submitted) {
          if (result.originResponse?.success != null) {
            this.snackBar.openFromComponent(SubmitUrlOriginResponseSnackbarComponent, { duration: 10000, data: { existingPodcast: false, response: result.originResponse?.success } });
          } else {
            this.snackBar.open('Podcast Sent!', "Ok", { duration: 3000 });
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
    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async result => {
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
        this.snackBar.open(message, "Ok", { duration: 10000 });
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
    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async result => {
        this.snackBar.open(result.replace(/([A-Z])/g, ' $1').trim(), "Ok", { duration: 10000 });
      });
  }

  addTerm() {
    const dialogRef = this.dialog.open(AddTermComponent, {
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async result => {
        if (result.updated) {
          this.snackBar.open(`Term '${result.term}' added`, "Ok", { duration: 10000 });
        }
      });
  }

  openDiscoverySchedule() {
    const dialogRef = this.dialog.open(DiscoveryScheduleComponent, {
      disableClose: true,
      autoFocus: true,
      width: '40em',
      maxWidth: '95vw'
    });
    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result?.saved) {
          this.snackBar.open('Discovery schedule saved', 'Ok', { duration: 5000 });
        }
      });
  }
}
