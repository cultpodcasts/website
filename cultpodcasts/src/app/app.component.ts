import { Component, ElementRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatIconRegistry } from "@angular/material/icon";
import { DomSanitizer } from "@angular/platform-browser";
import { SiteService } from './SiteService';
import { ISiteData } from './ISiteData';
import { MatDialog, MatDialogConfig } from "@angular/material/dialog";
import { SubmitPodcastComponent } from './submit-podcast/submit-podcast.component';
import { SendPodcastComponent } from './send-podcast/send-podcast.component';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass'],
})

export class AppComponent {
  siteData: ISiteData = {
    query: "",
    filter: null
  };

  @ViewChild('searchBox', { static: true }) searchBox: ElementRef | undefined;

  constructor(
    private http: HttpClient,
    private router: Router,
    private iconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private siteService: SiteService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar) {
    this.iconRegistry.addSvgIcon(`cultpodcasts`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/cultpodcasts.svg"));
    this.iconRegistry.addSvgIcon(`add-podcast`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/add-podcast.svg"));
    this.iconRegistry.addSvgIcon(`reddit`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/reddit.svg"));
    this.iconRegistry.addSvgIcon(`twitter`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/twitter.svg"));
    this.iconRegistry.addSvgIcon(`github`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/github.svg"));
    this.iconRegistry.addSvgIcon(`spotify`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/spotify.svg"));
    this.iconRegistry.addSvgIcon(`youtube`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/youtube.svg"));
    this.iconRegistry.addSvgIcon(`apple-podcasts`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/apple-podcasts.svg"));
  }

  ngOnInit() {
    this.siteService.currentSiteData.subscribe(siteData => {
      if (this.searchBox) {
        this.searchBox.nativeElement.value = siteData.query;
      };
    });
    navigator.serviceWorker.addEventListener('message', this.onSwMessage.bind(this));
  }

  onSwMessage(message: any) {
    if (message != null && message.data != null && message.data.msg == "podcast-share") {
      this.sendPodcast(new URL(message.data.url))
    }
  }

  sendPodcast(url: URL) {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.data = { url: url }
    this.dialog
      .open(SendPodcastComponent, dialogConfig)
      .afterClosed()
      .subscribe(result => {
        console.log(JSON.stringify(result))
        if (result && result.submitted) {
          let snackBarRef = this.snackBar.open('Podcast Sent!', "Ok", { duration: 3000 });
        }
      });
  }

  search = (input: HTMLInputElement) => {
    input.blur();
    this.router.navigate(['/search/' + input.value]);
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
          this.sendPodcast(new URL(result.url))
        }
      });
  }
}
