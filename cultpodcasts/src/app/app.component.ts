import { Component, Inject, OnDestroy, PLATFORM_ID, ViewChild } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { ShareMode } from "./share-mode.enum";
import { isPlatformBrowser } from '@angular/common';
import { ToolbarComponent } from './toolbar/toolbar.component';
import { MatIconModule, MatIconRegistry } from "@angular/material/icon";
import { DomSanitizer } from "@angular/platform-browser";
import { environment } from 'src/environments/environment';
import { SearchBarComponent } from "./search-bar/search-bar.component";
import { SeoService } from './seo.service';
import { WebPushService } from './web-push.service';
import { MatDialog } from '@angular/material/dialog';
import { EnablePushNotificationsDialogComponent } from './enable-push-notifications-dialog/enable-push-notifications-dialog.component';
import { ProfileService } from './profile.service';
import { MatMenuModule } from '@angular/material/menu';
import { FeatureSwitch } from './feature-switch.enum';
import { FeatureSwtichService } from './feature-switch-service';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  extractUrlFromDataTransfer,
  parseSubmittablePodcastUrl
} from './podcast-url-matcher';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass'],
  imports: [RouterOutlet, RouterLink, MatIconModule, MatMenuModule, ToolbarComponent, SearchBarComponent]
})

export class AppComponent implements OnDestroy {
  isBrowser: boolean;
  protected FeatureSwitch = FeatureSwitch;
  isDragOver: boolean = false;
  activeDropTarget: 'general' | 'podcast' | null = null;
  private ignoreDragUntilEnd = false;

  @ViewChild(ToolbarComponent)
  private toolbar!: ToolbarComponent;

  constructor(
    private iconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) platformId: any,
    seoService: SeoService,
    private webPushService: WebPushService,
    private dialog: MatDialog,
    private profileService: ProfileService,
    protected featureSwtichService: FeatureSwtichService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {
    seoService.AddRequiredMetaTags();
    this.isBrowser = isPlatformBrowser(platformId);
    this.registerSvg();
  }

  async ngOnInit(): Promise<any> {
    if (this.isBrowser) {
      this.initialiseBrowser();
      await this.profileService.init();
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      this.removeDragListeners();
    }
  }

  initialiseBrowser() {
    this.addDragListeners();
    navigator.serviceWorker.addEventListener('message', this.onSwMessage.bind(this));
    this.profileService.roles.subscribe(async roles => {
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

  async onSwMessage(message: any) {
    if (message != null && message.data != null && message.data.msg == "podcast-share") {
      await this.toolbar.sendPodcast({ url: message.data.url, podcastId: undefined, podcastName: undefined, shareMode: ShareMode.Share });
    }
  }

  get isOnPodcastPage(): boolean {
    return this.podcastPageName !== undefined;
  }

  get podcastPageName(): string | undefined {
    return this.resolvePodcastNameFromRoute();
  }

  onDragOver(event: DragEvent) {
    if (!this.isBrowser || !this.hasDroppableUrl(event)) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onTargetDragEnter(target: 'general' | 'podcast', event: DragEvent) {
    if (!this.isBrowser || !this.hasDroppableUrl(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.activeDropTarget = target;
  }

  onTargetDragLeave(event: DragEvent) {
    const related = event.relatedTarget as Node | null;
    const currentTarget = event.currentTarget as Node | null;
    if (!related || !currentTarget?.contains(related)) {
      this.activeDropTarget = null;
    }
  }

  async onDropGeneral(event: DragEvent) {
    event.stopPropagation();
    await this.handleDrop(event, false);
  }

  async onDropForPodcast(event: DragEvent) {
    event.stopPropagation();
    await this.handleDrop(event, true);
  }

  async onDrop(event: DragEvent) {
    if (this.isOnPodcastPage) {
      event.preventDefault();
      this.resetDragState();
      return;
    }
    await this.handleDrop(event, false);
  }

  private addDragListeners(): void {
    document.addEventListener('dragenter', this.onDocumentDragEnter);
    document.addEventListener('dragover', this.onDocumentDragOver);
    document.addEventListener('dragleave', this.onDocumentDragLeave);
    document.addEventListener('dragend', this.onDocumentDragEnd);
    document.addEventListener('drop', this.onDocumentDrop);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('mouseup', this.onPointerUp);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  private removeDragListeners(): void {
    document.removeEventListener('dragenter', this.onDocumentDragEnter);
    document.removeEventListener('dragover', this.onDocumentDragOver);
    document.removeEventListener('dragleave', this.onDocumentDragLeave);
    document.removeEventListener('dragend', this.onDocumentDragEnd);
    document.removeEventListener('drop', this.onDocumentDrop);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('mouseup', this.onPointerUp);
    window.removeEventListener('pointerup', this.onPointerUp);
  }

  private readonly onDocumentDragEnter = (event: DragEvent) => {
    if (this.ignoreDragUntilEnd || !this.hasDroppableUrl(event)) {
      return;
    }
    event.preventDefault();
    this.isDragOver = true;
  };

  private readonly onDocumentDragOver = (event: DragEvent) => {
    if (!this.hasDroppableUrl(event)) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  };

  private readonly onDocumentDragLeave = (event: DragEvent) => {
    if (!this.isDragOver) {
      return;
    }
    const related = event.relatedTarget as Node | null;
    if (related && document.documentElement.contains(related)) {
      return;
    }
    this.resetDragState(true);
  };

  private readonly onDocumentDragEnd = () => {
    this.ignoreDragUntilEnd = false;
    this.resetDragState();
  };

  private readonly onDocumentDrop = () => {
    this.resetDragState();
  };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.isDragOver) {
      this.resetDragState(true);
    }
  };

  private readonly onVisibilityChange = () => {
    if (document.hidden && this.isDragOver) {
      this.resetDragState(true);
    }
  };

  private readonly onWindowBlur = () => {
    if (this.isDragOver) {
      this.resetDragState(true);
    }
  };

  private readonly onPointerUp = () => {
    if (!this.isDragOver) {
      return;
    }
    window.setTimeout(() => {
      if (this.isDragOver) {
        this.resetDragState(true);
      }
    }, 0);
  };

  private resetDragState(fromCancel = false): void {
    this.isDragOver = false;
    this.activeDropTarget = null;
    this.ignoreDragUntilEnd = fromCancel;
  }

  private async handleDrop(event: DragEvent, forPodcast: boolean) {
    if (!this.isBrowser) {
      return;
    }
    event.preventDefault();
    this.resetDragState();

    const dataTransfer = event.dataTransfer;
    if (!dataTransfer) {
      return;
    }

    const rawUrl = extractUrlFromDataTransfer(dataTransfer);
    if (!rawUrl) {
      this.snackBar.open('No link found in drop', 'Ok', { duration: 3000 });
      return;
    }

    const url = parseSubmittablePodcastUrl(rawUrl);
    if (!url) {
      this.snackBar.open('Unsupported episode link', 'Ok', { duration: 4000 });
      return;
    }

    await this.toolbar.sendPodcast({
      url,
      podcastId: undefined,
      podcastName: forPodcast ? this.podcastPageName : undefined,
      shareMode: ShareMode.Text
    });
  }

  private hasDroppableUrl(event: DragEvent): boolean {
    const types = event.dataTransfer?.types ?? [];
    return types.includes('text/uri-list') || types.includes('text/plain') || types.includes('URL');
  }

  private resolvePodcastNameFromRoute(): string | undefined {
    const match = this.router.url.match(/^\/podcast\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }

  goTop(event: Event): void {
    event.preventDefault();

    if (!this.isBrowser) {
      return;
    }

    // Keep #top in the URL while avoiding a full document navigation.
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#top`);
    window.scrollTo(0, 0);
  }

  private registerSvg() {
    this.iconRegistry.addSvgIcon(`cultpodcasts`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/cultpodcasts.svg"));
    this.iconRegistry.addSvgIcon(`add-podcast`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/add-podcast.svg"));
    this.iconRegistry.addSvgIcon(`reddit`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/reddit.svg"));
    this.iconRegistry.addSvgIcon(`twitter`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/twitter.svg"));
    this.iconRegistry.addSvgIcon(`github`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/github.svg"));
    this.iconRegistry.addSvgIcon(`spotify`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/spotify.svg"));
    this.iconRegistry.addSvgIcon(`youtube`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/youtube.svg"));
    this.iconRegistry.addSvgIcon(`bbc-iplayer`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/BBC_iPlayer_2021_(symbol).svg"));
    this.iconRegistry.addSvgIcon(`bbc-sounds`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/bbc_sounds.svg"));
    this.iconRegistry.addSvgIcon(`internet-archive`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/Internet_Archive_logo_and_wordmark.svg"));
    this.iconRegistry.addSvgIcon(`profile`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/profile.svg"));
    this.iconRegistry.addSvgIcon(`bluesky`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/bluesky.svg"));
    this.iconRegistry.addSvgIcon(`android`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/android.svg"));
    this.iconRegistry.addSvgIcon(`visible`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/visible.svg"));
    this.iconRegistry.addSvgIcon(`removed`, this.domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/removed.svg"));
  }
}