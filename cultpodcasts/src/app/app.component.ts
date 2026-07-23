import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Inject,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
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
import { filter, map, startWith } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass'],
  imports: [RouterOutlet, RouterLink, MatIconModule, MatMenuModule, ToolbarComponent, SearchBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class AppComponent implements OnDestroy {
  protected readonly isBrowser: boolean;
  protected FeatureSwitch = FeatureSwitch;
  protected readonly isDragOver = signal(false);
  protected readonly activeDropTarget = signal<'general' | 'podcast' | null>(null);
  private readonly profileService = inject(ProfileService);
  private readonly authRoles = toSignal(this.profileService.roles, { initialValue: [] as string[] });
  protected readonly canSubmitUrlForPodcast = computed(() => this.authRoles().includes('Curator'));
  private readonly router = inject(Router);
  protected readonly routeUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );
  protected readonly podcastPageName = computed(() => {
    const match = this.routeUrl().match(/^\/podcast\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  });
  protected readonly isOnPodcastPage = computed(() => this.podcastPageName() !== undefined);
  private ignoreDragUntilEnd = false;

  @ViewChild(ToolbarComponent)
  private toolbar!: ToolbarComponent;

  private readonly destroyRef = inject(DestroyRef);
  private readonly webPushService = inject(WebPushService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  constructor(
    iconRegistry: MatIconRegistry,
    domSanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) platformId: object,
    seoService: SeoService,
    protected featureSwtichService: FeatureSwtichService,
  ) {
    seoService.AddRequiredMetaTags();
    this.isBrowser = isPlatformBrowser(platformId);
    this.registerSvg(iconRegistry, domSanitizer);
  }

  async ngOnInit(): Promise<void> {
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
    this.profileService.roles
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async roles => {
        if (roles.includes("Admin")) {
          var handled = await this.webPushService.subscribeToNotifications();
          if (!handled) {
            if (localStorage.getItem("neverAskForNotifications") != "true") {
              this.dialog
                .open(EnablePushNotificationsDialogComponent, { disableClose: true, autoFocus: true })
                .afterClosed()
                .pipe(takeUntilDestroyed(this.destroyRef))
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

  async onSwMessage(message: MessageEvent) {
    if (message != null && message.data != null && message.data.msg == "podcast-share") {
      await this.toolbar.sendPodcast({ url: message.data.url, podcastId: undefined, podcastName: undefined, shareMode: ShareMode.Share });
    }
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
    if (!this.isBrowser || !this.hasDroppableUrl(event) || !this.isDropTargetEnabled(target)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.activeDropTarget.set(target);
  }

  onTargetDragLeave(event: DragEvent) {
    const related = event.relatedTarget as Node | null;
    const currentTarget = event.currentTarget as Node | null;
    if (!related || !currentTarget?.contains(related)) {
      this.activeDropTarget.set(null);
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
    if (this.isOnPodcastPage() && this.canSubmitUrlForPodcast()) {
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
    this.isDragOver.set(true);
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
    if (!this.isDragOver()) {
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
    if (event.key === 'Escape' && this.isDragOver()) {
      this.resetDragState(true);
    }
  };

  private readonly onVisibilityChange = () => {
    if (document.hidden && this.isDragOver()) {
      this.resetDragState(true);
    }
  };

  private readonly onWindowBlur = () => {
    if (this.isDragOver()) {
      this.resetDragState(true);
    }
  };

  private readonly onPointerUp = () => {
    if (!this.isDragOver()) {
      return;
    }
    window.setTimeout(() => {
      if (this.isDragOver()) {
        this.resetDragState(true);
      }
    }, 0);
  };

  private resetDragState(fromCancel = false): void {
    this.isDragOver.set(false);
    this.activeDropTarget.set(null);
    this.ignoreDragUntilEnd = fromCancel;
  }

  private async handleDrop(event: DragEvent, forPodcast: boolean) {
    if (!this.isBrowser) {
      return;
    }
    if (forPodcast && !this.canSubmitUrlForPodcast()) {
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
      podcastName: forPodcast ? this.podcastPageName() : undefined,
      shareMode: ShareMode.Text
    });
  }

  private isDropTargetEnabled(target: 'general' | 'podcast'): boolean {
    if (target === 'podcast') {
      return this.canSubmitUrlForPodcast();
    }
    return true;
  }

  private hasDroppableUrl(event: DragEvent): boolean {
    const types = event.dataTransfer?.types ?? [];
    return types.includes('text/uri-list') || types.includes('text/plain') || types.includes('URL');
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

  private registerSvg(iconRegistry: MatIconRegistry, domSanitizer: DomSanitizer) {
    iconRegistry.addSvgIcon(`cultpodcasts`, domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/cultpodcasts.svg"));
    iconRegistry.addSvgIcon(`add-podcast`, domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/add-podcast.svg"));
    iconRegistry.addSvgIcon(`reddit`, domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/reddit.svg"));
    iconRegistry.addSvgIcon(`twitter`, domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/twitter.svg"));
    iconRegistry.addSvgIcon(`github`, domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/github.svg"));
    iconRegistry.addSvgIcon(`spotify`, domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/spotify.svg"));
    iconRegistry.addSvgIcon(`youtube`, domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/youtube.svg"));
    iconRegistry.addSvgIcon(`bbc-iplayer`, domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/BBC_iPlayer_2021_(symbol).svg"));
    iconRegistry.addSvgIcon(`bbc-sounds`, domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/bbc_sounds.svg"));
    iconRegistry.addSvgIcon(`internet-archive`, domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/Internet_Archive_logo_and_wordmark.svg"));
    iconRegistry.addSvgIcon(`profile`, domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/profile.svg"));
    iconRegistry.addSvgIcon(`bluesky`, domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/bluesky.svg"));
    iconRegistry.addSvgIcon(`android`, domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/android.svg"));
    iconRegistry.addSvgIcon(`visible`, domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/visible.svg"));
    iconRegistry.addSvgIcon(`removed`, domSanitizer.bypassSecurityTrustResourceUrl(environment.bundleAssetHost + "/assets/removed.svg"));
  }
}
