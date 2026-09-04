import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AuthServiceWrapper, HAS_LOGGED_IN_STORAGE_KEY } from '../auth-service-wrapper.class';
import { FeatureSwitchService } from '../feature-switch-service';
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
import { DiscoveryScheduleComponent } from '../discovery-schedule/discovery-schedule.component';
import { SupportedLanguagesComponent } from '../supported-languages/supported-languages.component';
import { TitleCasingRulesComponent } from '../title-casing-rules/title-casing-rules.component';
import { LanguageIgnoredSubjectsComponent } from '../language-ignored-subjects/language-ignored-subjects.component';
import { IndexerState } from '../indexer-state.interface';
import { SubmitUrlOriginResponseSnackbarComponent } from '../submit-url-origin-response-snackbar/submit-url-origin-response-snackbar.component';
import { MatBadgeModule } from '@angular/material/badge';
import { Share } from '../share.interface';
import { DiscoveryInfoService } from '../discovery-info.service';
import { submitSeriesFromForm } from '../submit-series.util';
@Component({
  selector: 'app-toolbar',
  imports: [
    MatToolbarModule,
    MatIconModule,
    MatMenuModule,
    RouterLink,
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

  /**
   * SSR (FakeAuth) always paints logged-out chrome. AuthServiceWrapper may seed a
   * cached avatar during browser bootstrap — defer signed-in UI until after the
   * first client render so hydration matches and (click)/menu triggers bind.
   * Skipping hydration left dead SSR DOM with no listeners on cold loads.
   */
  private readonly authChromeReady = signal(false);

  constructor() {
    afterNextRender(() => this.authChromeReady.set(true));
  }

  /** True while Auth0 has a user, or we still have a cached avatar during session restore. */
  protected showSignedInChrome(): boolean {
    return this.authChromeReady() && !!this.auth.avatarUrl();
  }

  protected avatarSrc(): string {
    return this.auth.avatarUrl() ?? '/assets/profile.svg';
  }

  login() {
    if (localStorage.getItem(HAS_LOGGED_IN_STORAGE_KEY)) {
      this.auth.loginWithRedirectToCurrentPage();
    } else {
      this.dialog
        .open(FirstLoginNoticeComponent, { disableClose: true, autoFocus: true })
        .afterClosed()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(async result => {
          if (result?.continue) {
            this.auth.loginWithRedirectToCurrentPage();
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
    this.auth.logoutKeepingCurrentPage();
  }

  async openSubmitPodcast() {
    this.dialog
      .open(SubmitPodcastComponent, { disableClose: true, autoFocus: true })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async result => {
        if (result?.url) {
          const { podcastId, podcastName } = submitSeriesFromForm(result.podcast);
          await this.sendPodcast({ url: result.url, podcastId, podcastName, shareMode: ShareMode.Text });
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

  async sendPodcast(
    share: Share,
    prepare?: () => Promise<Pick<Share, 'podcastId' | 'podcastName'> | 'cancelled' | void>
  ) {
    const dialog = this.dialog.open<SendPodcastComponent, any, SubmitDialogResponse>(SendPodcastComponent, { disableClose: true, autoFocus: true });
    dialog
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result && result.submitted) {
          if (result.originResponse?.success != null) {
            this.snackBar.openFromComponent(SubmitUrlOriginResponseSnackbarComponent, { duration: 10000, data: { existingPodcast: false, response: result.originResponse?.success, roles: this.authRoles() } });
          } else {
            this.snackBar.open('Podcast Sent!', "Ok", { duration: 3000 });
          }
        }
      });
    const component = dialog.componentInstance;
    component.beginBusy();
    try {
      if (prepare) {
        const prepared = await prepare();
        if (prepared === 'cancelled') {
          dialog.close({ submitted: false });
          return;
        }
        if (prepared) {
          share = { ...share, ...prepared };
        }
      }
      await component.submit(share);
    } catch {
      component.markSubmitError();
    }
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

  openTitleCasingRules() {
    const dialogRef = this.dialog.open(TitleCasingRulesComponent, {
      disableClose: true,
      autoFocus: true,
      width: '44em',
      maxWidth: '95vw',
      maxHeight: '90vh'
    });
    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result?.saved) {
          this.snackBar.open('Title casing rules saved', 'Ok', { duration: 5000 });
        }
      });
  }

  openLanguageIgnoredSubjects() {
    const dialogRef = this.dialog.open(LanguageIgnoredSubjectsComponent, {
      disableClose: true,
      autoFocus: true,
      width: '40em',
      maxWidth: '95vw',
      maxHeight: '90vh'
    });
    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result?.saved) {
          this.snackBar.open('Language ignored subjects saved', 'Ok', { duration: 5000 });
        }
      });
  }

  openSupportedLanguages() {
    const dialogRef = this.dialog.open(SupportedLanguagesComponent, {
      disableClose: true,
      autoFocus: true,
      width: '36em',
      maxWidth: '95vw'
    });
    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result?.saved) {
          this.snackBar.open(
            'Supported languages updated (saved to Cosmos and published to R2).',
            'Ok',
            { duration: 5000 }
          );
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
