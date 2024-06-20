import { Component, ElementRef, Inject, PLATFORM_ID, ViewChild } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { SiteService } from './SiteService';
import { ShareMode } from "./ShareMode";
import { SearchBoxMode } from './SearchBoxMode';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { NgIf, isPlatformBrowser } from '@angular/common';
import { ToolbarComponent } from './toolbar/toolbar.component';
import { MatIconModule, MatIconRegistry } from "@angular/material/icon";
import { DomSanitizer } from "@angular/platform-browser";
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass'],
  standalone: true,
  imports: [RouterLink, NgIf, MatButtonModule, FormsModule, MatFormFieldModule, MatIconModule, MatChipsModule, MatInputModule, RouterOutlet, ToolbarComponent]
})

export class AppComponent {
  searchChip: string | null = null;
  searchBoxMode: SearchBoxMode = SearchBoxMode.Default;
  isBrowser: boolean;

  @ViewChild('searchBox', { static: true })
  searchBox: ElementRef | undefined;

  @ViewChild(ToolbarComponent)
  private toolbar!: ToolbarComponent;

  constructor(
    private router: Router,
    private siteService: SiteService,
    private iconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) private platformId: any) {
      console.log("Environment: "+environment.name);
    this.isBrowser = isPlatformBrowser(platformId);
    this.registerSvg();
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
      await this.toolbar.sendPodcast({ url: message.data.url, podcastId: undefined, shareMode: ShareMode.Share });
    }
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

  private registerSvg() {
      this.iconRegistry.addSvgIcon(`cultpodcasts`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.assetHost + "/assets/cultpodcasts.svg"));
      this.iconRegistry.addSvgIcon(`add-podcast`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.assetHost + "/assets/add-podcast.svg"));
      this.iconRegistry.addSvgIcon(`reddit`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.assetHost + "/assets/reddit.svg"));
      this.iconRegistry.addSvgIcon(`twitter`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.assetHost + "/assets/twitter.svg"));
      this.iconRegistry.addSvgIcon(`github`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.assetHost + "/assets/github.svg"));
      this.iconRegistry.addSvgIcon(`spotify`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.assetHost + "/assets/spotify.svg"));
      this.iconRegistry.addSvgIcon(`youtube`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.assetHost + "/assets/youtube.svg"));
      this.iconRegistry.addSvgIcon(`apple-podcasts`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.assetHost + "/assets/apple-podcasts.svg"));
      this.iconRegistry.addSvgIcon(`profile`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.assetHost + "/assets/profile.svg"));
  }
}