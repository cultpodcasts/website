import { Component, Inject, PLATFORM_ID, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ShareMode } from "./ShareMode";
import { isPlatformBrowser } from '@angular/common';
import { ToolbarComponent } from './toolbar/toolbar.component';
import { MatIconModule, MatIconRegistry } from "@angular/material/icon";
import { DomSanitizer } from "@angular/platform-browser";
import { environment } from 'src/environments/environment';
import { SearchBarComponent } from "./search-bar/search-bar.component";

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.sass'],
    standalone: true,
    imports: [RouterOutlet, MatIconModule, ToolbarComponent, SearchBarComponent]
})

export class AppComponent {
  isBrowser: boolean;

  @ViewChild(ToolbarComponent)
  private toolbar!: ToolbarComponent;

  constructor(
    private iconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) private platformId: any) {
      console.log("Environment: " + environment.name);
      this.isBrowser = isPlatformBrowser(platformId);
      this.registerSvg();
  }

  ngOnInit() {
    if (this.isBrowser) {
      navigator.serviceWorker.addEventListener('message', this.onSwMessage.bind(this));
    }
  }

  async onSwMessage(message: any) {
    if (message != null && message.data != null && message.data.msg == "podcast-share") {
      await this.toolbar.sendPodcast({ url: message.data.url, podcastId: undefined, shareMode: ShareMode.Share });
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