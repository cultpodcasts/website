import { Component, ElementRef, Inject, PLATFORM_ID, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { MatIconRegistry, MatIconModule } from "@angular/material/icon";
import { DomSanitizer } from "@angular/platform-browser";
import { SiteService } from './SiteService';
import { MatDialog, MatDialogConfig } from "@angular/material/dialog";
import { SubmitPodcastComponent } from './submit-podcast/submit-podcast.component';
import { SendPodcastComponent } from './send-podcast/send-podcast.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IShare } from './IShare';
import { ShareMode } from "./ShareMode";
import { SearchBoxMode } from './SearchBoxMode';
import { AuthServiceWrapper } from './AuthServiceWrapper';
import { FeatureSwtichService } from './FeatureSwitchService';
import { FeatureSwitch } from './FeatureSwitch';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { NgIf, AsyncPipe, isPlatformBrowser } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass'],
  standalone: true,
  imports: [MatToolbarModule, RouterLink, NgIf, MatMenuModule, MatIconModule, MatButtonModule, FormsModule, MatFormFieldModule, MatChipsModule, MatInputModule, RouterOutlet, AsyncPipe]
})

export class AppComponent {
  @ViewChild('searchBox', { static: true }) searchBox: ElementRef | undefined;
  searchChip: string | null = null;
  searchBoxMode: SearchBoxMode = SearchBoxMode.Default;
  roles: string[] = [];

  public FeatureSwitch = FeatureSwitch;
  isBrowser: boolean;

  constructor(
    private http: HttpClient,
    private router: Router,
    private iconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private siteService: SiteService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    protected auth: AuthServiceWrapper,
    protected featureSwtichService: FeatureSwtichService,
    @Inject(PLATFORM_ID) private platformId: any) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.iconRegistry.addSvgIcon(`cultpodcasts`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/cultpodcasts.svg"));
    this.iconRegistry.addSvgIcon(`add-podcast`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/add-podcast.svg"));
    this.iconRegistry.addSvgIcon(`reddit`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/reddit.svg"));
    this.iconRegistry.addSvgIcon(`twitter`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/twitter.svg"));
    this.iconRegistry.addSvgIcon(`github`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/github.svg"));
    this.iconRegistry.addSvgIcon(`spotify`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/spotify.svg"));
    this.iconRegistry.addSvgIcon(`youtube`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/youtube.svg"));
    this.iconRegistry.addSvgIcon(`apple-podcasts`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/apple-podcasts.svg"));
    this.iconRegistry.addSvgIcon(`profile`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/profile.svg"));
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
    this.siteService.currentSiteData.subscribe(siteData => {
      if (this.searchBox) {
        this.searchBox.nativeElement.value = siteData.query;
        if (siteData.podcast != null) {
          this.searchChip = siteData.podcast;
          this.searchBoxMode = SearchBoxMode.Podcast;
        } else if (siteData.subject != null) {
          this.searchChip = siteData.subject;
          this.searchBoxMode = SearchBoxMode.Subject;
        } else {
          this.searchChip = null;
          this.searchBoxMode = SearchBoxMode.Default;
        }
      };
    });
    if (this.isBrowser) {
      navigator.serviceWorker.addEventListener('message', this.onSwMessage.bind(this));
    }
  }

  async onSwMessage(message: any) {
    if (message != null && message.data != null && message.data.msg == "podcast-share") {
      await this.sendPodcast({ url: message.data.url, podcastId: undefined, shareMode: ShareMode.Share });
    }
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

  search = (input: HTMLInputElement) => {
    input.blur();
    if (this.searchChip) {
      if (this.searchBoxMode == SearchBoxMode.Podcast) {
        this.router.navigate(['/podcast/' + this.searchChip + "/" + input.value]);
      } else if (this.searchBoxMode == SearchBoxMode.Subject) {
        this.router.navigate(['/subject/' + this.searchChip + "/" + input.value]);
      }
    } else {
      this.router.navigate(['/search/' + input.value]);
    }
  };

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

  removeSearchChip() {
    this.searchChip = null;
    var query = this.siteService.getSiteData().query;
    if (query && query != "") {
      const url = `/search/` + query;
      this.router.navigate([url]);
    } else {
      const url = `/`;
      this.router.navigate([url]);
    }
  }

  searchChipDisplay() {
    const width = screen.availWidth > 500 ? 30 : screen.availWidth > 400 ? 15 : 10;
    if (this.searchChip) {
      if (this.searchChip.length > width) {
        return this.searchChip.substring(0, width - 1) + "…";
      } else {
        return this.searchChip;
      }
    } else {
      return null;
    }
  }

  login() {
    this.auth.authService.loginWithRedirect();;
  }

  logout() {
    this.auth.authService.logout();
  }
}