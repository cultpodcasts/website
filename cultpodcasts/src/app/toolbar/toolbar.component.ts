import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { FeatureSwtichService } from '../FeatureSwitchService';
import { isPlatformBrowser, NgIf, AsyncPipe } from '@angular/common';
import { FeatureSwitch } from '../FeatureSwitch';
import { MatIconModule } from "@angular/material/icon";
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { SiteService } from '../SiteService';
import { RouterLink } from '@angular/router';
import { MatDialog, MatDialogConfig } from "@angular/material/dialog";
import { SubmitPodcastComponent } from '../submit-podcast/submit-podcast.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SendPodcastComponent } from '../send-podcast/send-podcast.component';
import { IShare } from '../IShare';
import { ShareMode } from "../ShareMode";

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [MatToolbarModule, MatIconModule, MatMenuModule, RouterLink, NgIf, AsyncPipe],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.sass',
  host: { ngSkipHydration: 'true' }
})
export class ToolbarComponent {
  roles: string[] = [];
  public FeatureSwitch = FeatureSwitch;
  isBrowser: boolean;

  constructor(
    protected siteService: SiteService,
    protected auth: AuthServiceWrapper,
    protected featureSwtichService: FeatureSwtichService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    @Inject(PLATFORM_ID) private platformId: any) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit() {
    if (this.isBrowser) {
      localStorage.removeItem("hasLoggedIn");
      this.auth.authService.user$.subscribe(user => {
        if (user && user["https://api.cultpodcasts.com/roles"]) {
          this.roles = user["https://api.cultpodcasts.com/roles"]
          localStorage.setItem("hasLoggedIn", "true");
        }
        else
          this.roles = [];
      })
    }
  }

  login() {
    this.auth.authService.loginWithRedirect();;
  }

  logout() {
    this.auth.authService.logout();
  }

  async openSubmitPodcast() {
    const dialogConfig = new MatDialogConfig();

    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;

    this.dialog
      .open(SubmitPodcastComponent, dialogConfig)
      .afterClosed()
      .subscribe(async result => {
        if (result?.url) {
          await this.sendPodcast({ url: result.url, podcastId: result.podcast?.id, shareMode: ShareMode.Text });
        }
      });
  }

  async sendPodcast(share: IShare) {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    const dialog = this.dialog.open(SendPodcastComponent, dialogConfig);
    dialog
      .afterClosed()
      .subscribe(result => {
        if (result && result.submitted) {
          if (result.originResponse) {
            let episode: string;
            if (result.originResponse.episode === "Created") {
              episode = "Episode created.";
            } else if (result.originResponse.episode === "Enriched") {
              episode = "Episode enriched.";
            } else {
              episode = "Episode not created.";
            }
            let podcast = "";
            if (result.originResponse.podcast === "Created") {
              podcast = "Podcast created.";
            } else if (result.originResponse.podcast === "Enriched") {
              podcast = "Podcast enriched.";
            } else if (result.originResponse.podcast === "PodcastRemoved") {
              podcast = "Podcast Removed.";
            }
            let snackBarRef = this.snackBar.open(`Podcast Sent direct to database. ${podcast} ${episode}`, "Ok", { duration: 10000 });
          } else {
            let snackBarRef = this.snackBar.open('Podcast Sent!', "Ok", { duration: 3000 });
          }
        }
      });
    await dialog.componentInstance.submit(share);
  }
}
