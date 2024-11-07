import { Component, Inject, isDevMode, PLATFORM_ID, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ShareMode } from "./ShareMode";
import { isPlatformBrowser } from '@angular/common';
import { ToolbarComponent } from './toolbar/toolbar.component';
import { MatIconModule, MatIconRegistry } from "@angular/material/icon";
import { DomSanitizer } from "@angular/platform-browser";
import { environment } from 'src/environments/environment';
import { SearchBarComponent } from "./search-bar/search-bar.component";
import { SeoService } from './seo.service';
import { WebPushService } from './web-push.service';
import { AuthServiceWrapper } from './AuthServiceWrapper';
import { MatDialog } from '@angular/material/dialog';
import { EnablePushNotificationsDialogComponent } from './enable-push-notifications-dialog/enable-push-notifications-dialog.component';

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
    @Inject(PLATFORM_ID) platformId: any,
    seoService: SeoService,
    private webPushService: WebPushService,
    protected auth: AuthServiceWrapper,
    private dialog: MatDialog
  ) {
    seoService.AddRequiredMetaTags();
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      this.registerSvg();
    }
  }

  ngOnInit() {
    if (this.isBrowser) {
      navigator.serviceWorker.addEventListener('message', this.onSwMessage.bind(this));
      this.auth.roles.subscribe(async roles => {
        if (roles.includes("Admin")) {
          var handled = await this.webPushService.subscribeToNotifications();
          if (!handled) {
            if (localStorage.getItem("neverAskForNotifications") != "true") {
              this.dialog
                .open(EnablePushNotificationsDialogComponent, { disableClose: true, autoFocus: true })
                .afterClosed()
                .subscribe(async result => {
                  if (result) {
                    await this.webPushService.subscribeToNotifications();
                  }
                });
            }
          }
        }
      });
    }
  }

  async onSwMessage(message: any) {
    if (message != null && message.data != null && message.data.msg == "podcast-share") {
      await this.toolbar.sendPodcast({ url: message.data.url, podcastId: undefined, podcastName: undefined, shareMode: ShareMode.Share });
    }
  }

  private registerSvg() {
    this.iconRegistry.addSvgIcon(`cultpodcasts`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/cultpodcasts.svg"));
    this.iconRegistry.addSvgIcon(`add-podcast`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/add-podcast.svg"));
    this.iconRegistry.addSvgIcon(`reddit`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/reddit.svg"));
    this.iconRegistry.addSvgIcon(`twitter`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/twitter.svg"));
    this.iconRegistry.addSvgIcon(`github`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/github.svg"));
    this.iconRegistry.addSvgIcon(`spotify`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/spotify.svg"));
    this.iconRegistry.addSvgIcon(`youtube`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/youtube.svg"));
    this.iconRegistry.addSvgIcon(`apple-podcasts`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/apple-podcasts.svg"));
    this.iconRegistry.addSvgIcon(`profile`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/profile.svg"));
  }
}