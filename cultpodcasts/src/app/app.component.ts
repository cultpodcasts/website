import { Component, ElementRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatIconRegistry } from "@angular/material/icon";
import { DomSanitizer } from "@angular/platform-browser";
import { SiteService } from './SiteService';
import { MatDialog, MatDialogConfig } from "@angular/material/dialog";
import { SubmitPodcastComponent } from './submit-podcast/submit-podcast.component';
import { SendPodcastComponent } from './send-podcast/send-podcast.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IShare } from './IShare';
import { ShareMode } from "./ShareMode";
import { SearchBoxMode } from './SearchBoxMode';
import { AuthService } from '@auth0/auth0-angular';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass']
})

export class AppComponent {

  @ViewChild('searchBox', { static: true }) searchBox: ElementRef | undefined;
  searchChip: string | null = null;
  searchBoxMode: SearchBoxMode = SearchBoxMode.Default;

  constructor(
    private http: HttpClient,
    private router: Router,
    private iconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private siteService: SiteService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    protected auth: AuthService) {
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
          this.searchChip= null;
          this.searchBoxMode = SearchBoxMode.Default;
        }
      };
    });
    navigator.serviceWorker.addEventListener('message', this.onSwMessage.bind(this));
  }

  onSwMessage(message: any) {
    if (message != null && message.data != null && message.data.msg == "podcast-share") {
      this.sendPodcast({ url: message.data.url, shareMode: ShareMode.Share });
    }
  }

  sendPodcast(share: IShare) {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.data = share;
    this.dialog
      .open(SendPodcastComponent, dialogConfig)
      .afterClosed()
      .subscribe(result => {
        if (result && result.submitted) {
          let snackBarRef = this.snackBar.open('Podcast Sent!', "Ok", { duration: 3000 });
        }
      });
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

  top(event: any) {
    event.stopPropagation();
    event.preventDefault()
    const element = document.querySelector('body');
    element?.scrollIntoView();
  };

  openSubmitPodcast() {
    const dialogConfig = new MatDialogConfig();

    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;

    this.dialog
      .open(SubmitPodcastComponent, dialogConfig)
      .afterClosed()
      .subscribe(result => {
        if (result?.url) {
          this.sendPodcast({ url: result.url, shareMode: ShareMode.Text });
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
    if (this.searchChip) {
      if (this.searchChip.length > 10) {
        return this.searchChip.substring(0, 9) + "…";
      } else {
        return this.searchChip;
      }
    } else {
      return null;
    }
  }

}
