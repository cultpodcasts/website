import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
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
import { registerSvgIcons } from './register-svg-icons';
import { SearchBarComponent } from "./search-bar/search-bar.component";
import { EpisodePlayerComponent } from './episode-player/episode-player.component';
import { ResumeSessionPromptComponent } from './resume-session-prompt/resume-session-prompt.component';
import { SeoService } from './seo.service';
import { WebPushService } from './web-push.service';
import { MatDialog } from '@angular/material/dialog';
import { EnablePushNotificationsDialogComponent } from './enable-push-notifications-dialog/enable-push-notifications-dialog.component';
import { ProfileService } from './profile.service';
import { MatMenuModule } from '@angular/material/menu';
import { FeatureSwitch } from './feature-switch.enum';
import { FeatureSwitchService } from './feature-switch-service';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  extractUrlFromDataTransfer,
  parseSubmittablePodcastUrl
} from './podcast-url-matcher';
import { confirmPageDropIfOtherSeries, resolveSeriesForAttach } from './submit-series-conflict';
import { generalDropSeries, shouldCallSubmitUrlLookup } from './submit-ingest-ux';
import { SubmitSeriesResolveService } from './submit-series-resolve.service';
import { SubmitUrlLookupService } from './submit-url-lookup.service';
import { filter, map, startWith } from 'rxjs';
import { scheduleChromeSync } from './episode-form.util';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass'],
  imports: [RouterOutlet, RouterLink, MatIconModule, MatMenuModule, ToolbarComponent, SearchBarComponent, EpisodePlayerComponent, ResumeSessionPromptComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class AppComponent implements OnDestroy, AfterViewInit {
  private static readonly BACK_TO_TOP_THRESHOLD_PX = 480;
  private static readonly DOCK_INLINE_GAP_PX = 12;
  /** Match app.component.sass narrow chrome; search stays docked in the header row. */
  private static readonly NARROW_CHROME_MQ = '(max-width: 700px)';

  private static isHomePath(url: string): boolean {
    const path = url.split('?')[0].split('#')[0];
    return path === '/' || path === '';
  }

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
  protected readonly isHomePage = computed(() => AppComponent.isHomePath(this.routeUrl()));
  private ignoreDragUntilEnd = false;
  /** Cleared when Escape/blur cancel never gets a matching `dragend` (common for external URL drags). */
  private ignoreDragClearTimer: ReturnType<typeof setTimeout> | null = null;

  /** Shows the floating "back to top" control once the user has scrolled well past the fold. */
  protected readonly showBackToTop = signal(false);
  /**
   * Search docked into the sticky logo bar. Browse routes must stay docked from
   * the first paint (SSR + client) so hydration class bindings match — a one-shot
   * signal seeded before NavigationEnd left content pages as browse-shell without
   * chrome-stuck. Homepage scroll docking uses homeScrollDocked instead.
   */
  private readonly homeScrollDocked = signal(false);
  private readonly narrowChrome = signal(false);
  protected readonly chromeStuck = computed(
    () => !this.isHomePage() || this.homeScrollDocked()
  );
  /** Narrow chrome only: stretch search across the logo↔actions gap. Wide stays 640px. */
  protected readonly fillHeaderSearchGap = computed(() => this.narrowChrome());
  private scrollRaf = 0;
  private narrowChromeQuery: MediaQueryList | undefined;
  /** Remeasure docked search when toolbar end controls settle (e.g. avatar after auth). */
  private chromeEndControlsObserver: ResizeObserver | undefined;

  @ViewChild(ToolbarComponent)
  private toolbar!: ToolbarComponent;

  @ViewChild('chromeBar')
  private chromeBar?: ElementRef<HTMLElement>;

  @ViewChild('chromeSearch')
  private chromeSearch?: ElementRef<HTMLElement>;

  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly webPushService = inject(WebPushService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly seriesResolve = inject(SubmitSeriesResolveService);
  private readonly submitLookup = inject(SubmitUrlLookupService);

  constructor(
    iconRegistry: MatIconRegistry,
    domSanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) platformId: object,
    seoService: SeoService,
    protected featureSwitchService: FeatureSwitchService,
  ) {
    seoService.AddRequiredMetaTags();
    this.isBrowser = isPlatformBrowser(platformId);
    registerSvgIcons(iconRegistry, domSanitizer);
  }

  async ngOnInit(): Promise<void> {
    if (this.isBrowser) {
      this.initialiseBrowser();
      await this.profileService.init();
    }
  }

  ngAfterViewInit(): void {
    // Cold-load browse routes start docked; measure before fallback CSS covers toolbar actions.
    scheduleChromeSync(() => this.syncChromeFromScroll(), this.isBrowser);
    this.observeChromeEndControls();
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      this.clearIgnoreDragTimer();
      this.removeDragListeners();
      this.removeScrollListener();
      this.narrowChromeQuery?.removeEventListener('change', this.onNarrowChromeChange);
      window.removeEventListener('resize', this.onWindowResize);
      this.chromeEndControlsObserver?.disconnect();
    }
  }

  initialiseBrowser() {
    this.addDragListeners();
    this.narrowChromeQuery = window.matchMedia(AppComponent.NARROW_CHROME_MQ);
    this.narrowChrome.set(this.narrowChromeQuery.matches);
    this.narrowChromeQuery.addEventListener('change', this.onNarrowChromeChange);
    this.addScrollListener();
    window.addEventListener('resize', this.onWindowResize, { passive: true });
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        startWith(null),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        // scrollPositionRestoration may settle after NavigationEnd; re-measure next frame.
        requestAnimationFrame(() => this.syncChromeFromScroll());
      });
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
      const parsed = parseSubmittablePodcastUrl(String(message.data.url ?? ''));
      if (!parsed) {
        return;
      }
      await this.toolbar.sendPodcast(
        { url: parsed, podcastId: undefined, podcastName: undefined, shareMode: ShareMode.Share },
        async () => this.generalDropPersistSeries(parsed.href)
      );
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

  private addScrollListener(): void {
    window.addEventListener('scroll', this.onWindowScroll, { passive: true });
    this.onWindowScroll();
  }

  private removeScrollListener(): void {
    window.removeEventListener('scroll', this.onWindowScroll);
    if (this.scrollRaf) {
      window.cancelAnimationFrame(this.scrollRaf);
      this.scrollRaf = 0;
    }
  }

  private readonly onWindowScroll = () => {
    if (this.scrollRaf) {
      return;
    }
    this.scrollRaf = window.requestAnimationFrame(() => {
      this.scrollRaf = 0;
      this.syncChromeFromScroll();
    });
  };

  private readonly onWindowResize = () => {
    this.layoutChromeSearch();
  };

  private readonly onNarrowChromeChange = () => {
    this.narrowChrome.set(!!this.narrowChromeQuery?.matches);
    this.syncChromeFromScroll();
  };

  private isNarrowChrome(): boolean {
    return this.narrowChrome();
  }

  private syncChromeFromScroll(): void {
    const y = window.scrollY;
    this.showBackToTop.set(y > AppComponent.BACK_TO_TOP_THRESHOLD_PX);

    const bar = this.chromeBar?.nativeElement;
    const search = this.chromeSearch?.nativeElement;
    if (!bar || !search) {
      return;
    }

    // Browse: chrome-stuck from first paint. Wide uses the 640px pin; narrow fills the gap.
    if (!this.isHomePage()) {
      if (this.homeScrollDocked()) {
        this.homeScrollDocked.set(false);
      }
      this.layoutDockedSearch();
      return;
    }

    // Narrow homepage: keep search in the header row (same as browse).
    if (this.isNarrowChrome()) {
      if (!this.homeScrollDocked()) {
        this.homeScrollDocked.set(true);
        requestAnimationFrame(() => requestAnimationFrame(() => this.layoutDockedSearch()));
      } else {
        this.layoutDockedSearch();
      }
      return;
    }

    if (this.homeScrollDocked()) {
      // Release when in-flow overlay would sit below the stick line (same Y as
      // the pin) — not at a tiny scroll threshold, which teleports the field.
      if (y < this.homePinAtScrollY(bar, search) - 2) {
        this.homeScrollDocked.set(false);
        this.changeDetector.detectChanges();
        this.layoutDroppedSearch();
      } else {
        this.clearDockedSearchLayout(search);
      }
      return;
    }

    // Pin when sticky `top` has caught — field is already at in-bar Y.
    if (search.getBoundingClientRect().top <= this.homeStickTop(bar, search) + 1) {
      this.homeScrollDocked.set(true);
      this.changeDetector.detectChanges();
      this.clearDockedSearchLayout(search);
    } else {
      this.layoutDroppedSearch();
    }
  }

  /** Docked (fixed in the bar) or dropped (centered overlay) — do not keep docked width on the overlay. */
  private layoutChromeSearch(): void {
    if (this.chromeStuck()) {
      this.layoutDockedSearch();
    } else {
      this.layoutDroppedSearch();
    }
  }

  /**
   * Narrow chrome: pin search between the logo mark and add/profile (or overflow
   * menu). Wide viewports keep the 640px centered field — do not stretch the gap.
   */
  private layoutDockedSearch(): void {
    const search = this.chromeSearch?.nativeElement;
    if (!search || !this.chromeStuck()) {
      return;
    }
    if (!this.isNarrowChrome()) {
      this.clearDockedSearchLayout(search);
      return;
    }
    const gap = this.measureChromeSearchGap();
    if (!gap) {
      return;
    }
    this.applySearchGapStyles(search, gap);
  }

  /** Viewport Y where the overlay becomes stuck in the logo row (matches Sass `top`). */
  private homeStickTop(bar: HTMLElement, search: HTMLElement): number {
    const barHeight = Math.max(bar.getBoundingClientRect().height, 52);
    const searchHeight = Math.min(search.offsetHeight || 48, barHeight - 8);
    return Math.max(0, (barHeight - searchHeight) / 2);
  }

  /** scrollY at which in-flow overlay Y equals `homeStickTop` (no teleport). */
  private homePinAtScrollY(bar: HTMLElement, search: HTMLElement): number {
    const shell = bar.closest('#body');
    const gapRaw = shell
      ? getComputedStyle(shell).getPropertyValue('--site-chrome-search-gap')
      : '';
    const gap = Number.parseFloat(gapRaw) || 12;
    const barHeight = Math.max(bar.getBoundingClientRect().height, 52);
    return barHeight + gap - this.homeStickTop(bar, search);
  }

  /** Home at rest: drop docked inline left/width so CSS can center the overlay. */
  private layoutDroppedSearch(): void {
    const search = this.chromeSearch?.nativeElement;
    if (!search || this.chromeStuck()) {
      return;
    }
    this.clearDockedSearchLayout(search);
  }

  private measureChromeSearchGap(): { left: number; width: number; top: number } | null {
    const bar = this.chromeBar?.nativeElement;
    const search = this.chromeSearch?.nativeElement;
    if (!bar || !search) {
      return null;
    }

    const site = bar.querySelector('#site') as HTMLElement | null;
    // Prefer the visible end control: social cluster when shown, else overflow menu.
    const social = bar.querySelector('#socialbuttons') as HTMLElement | null;
    const menu = bar.querySelector('button#menu') as HTMLElement | null;
    const socialVisible = !!social && social.getClientRects().length > 0;
    const end = socialVisible ? social : menu;
    if (!site || !end) {
      return null;
    }

    // Anchor to the logo image so a still-visible title span cannot steal the gap.
    const siteAnchor = (site.querySelector('img') as HTMLElement | null) ?? site;
    const inset = AppComponent.DOCK_INLINE_GAP_PX;
    const siteRect = siteAnchor.getBoundingClientRect();
    const endRect = end.getBoundingClientRect();
    const barHeight = Math.max(bar.getBoundingClientRect().height, 52);
    const left = Math.max(inset, Math.round(siteRect.right + inset));
    const right = Math.min(window.innerWidth - inset, Math.round(endRect.left - inset));
    const width = Math.max(120, right - left);
    const searchHeight = Math.min(search.offsetHeight || 40, barHeight - 8);
    const top = Math.max(0, (barHeight - searchHeight) / 2);
    return { left, width, top };
  }

  private applySearchGapStyles(
    search: HTMLElement,
    gap: { left: number; width: number; top: number }
  ): void {
    search.style.right = 'auto';
    search.style.width = `${gap.width}px`;
    search.style.marginLeft = '0';
    search.style.marginRight = '0';
    search.style.left = `${gap.left}px`;
    search.style.top = `${gap.top}px`;
    search.style.transform = 'none';
  }

  /** Remeasure when add/profile/menu size changes (avatar swap after hydration). */
  private observeChromeEndControls(): void {
    if (!this.isBrowser || typeof ResizeObserver === 'undefined') {
      return;
    }
    const bar = this.chromeBar?.nativeElement;
    if (!bar) {
      return;
    }
    this.chromeEndControlsObserver?.disconnect();
    this.chromeEndControlsObserver = new ResizeObserver(() => {
      this.layoutChromeSearch();
    });
    const social = bar.querySelector('#socialbuttons');
    const menu = bar.querySelector('button#menu');
    if (social) {
      this.chromeEndControlsObserver.observe(social);
    }
    if (menu) {
      this.chromeEndControlsObserver.observe(menu);
    }
  }

  private clearDockedSearchLayout(search: HTMLElement): void {
    search.style.left = '';
    search.style.right = '';
    search.style.width = '';
    search.style.top = '';
    search.style.transform = '';
    search.style.marginLeft = '';
    search.style.marginRight = '';
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
    this.clearIgnoreDragTimer();
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

  private clearIgnoreDragTimer(): void {
    if (this.ignoreDragClearTimer != null) {
      clearTimeout(this.ignoreDragClearTimer);
      this.ignoreDragClearTimer = null;
    }
  }

  private resetDragState(fromCancel = false): void {
    this.isDragOver.set(false);
    this.activeDropTarget.set(null);
    this.clearIgnoreDragTimer();
    if (fromCancel) {
      // Suppress immediate re-show from the same gesture, but Escape on an
      // external URL drag often never fires document `dragend`, so clear soon
      // or the overlay stays dead until a full reload.
      this.ignoreDragUntilEnd = true;
      this.ignoreDragClearTimer = setTimeout(() => {
        this.ignoreDragClearTimer = null;
        this.ignoreDragUntilEnd = false;
      }, 50);
    } else {
      this.ignoreDragUntilEnd = false;
    }
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

    let podcastId: string | undefined;
    let podcastName: string | undefined;
    if (forPodcast) {
      const name = this.podcastPageName();
      if (!name) {
        this.snackBar.open('Could not resolve this series from the page.', 'Ok', { duration: 5000 });
        return;
      }
      await this.toolbar.sendPodcast(
        { url, podcastId: undefined, podcastName: undefined, shareMode: ShareMode.Text },
        async () => {
          const outcome = await resolveSeriesForAttach(this.seriesResolve, this.dialog, name);
          if (outcome.kind !== 'selection' || !outcome.selection.podcastId) {
            if (outcome.kind !== 'cancelled') {
              this.snackBar.open('Could not resolve this series. Choose a catalogue row or try again.', 'Ok', { duration: 5000 });
            }
            return 'cancelled';
          }
          const pagePodcastId = outcome.selection.podcastId;
          const pagePodcastName = outcome.selection.podcastName ?? name;
          const lookup = await this.lookupSubmitUrl(url.href);
          const proceed = await confirmPageDropIfOtherSeries(
            this.dialog,
            lookup,
            pagePodcastId,
            pagePodcastName
          );
          if (!proceed) {
            return 'cancelled';
          }
          return { podcastId: pagePodcastId, podcastName: outcome.selection.podcastName };
        }
      );
      return;
    }

    await this.toolbar.sendPodcast(
      { url, podcastId, podcastName, shareMode: ShareMode.Text },
      async () => this.generalDropPersistSeries(url.href)
    );
  }

  private async generalDropPersistSeries(href: string) {
    if (!shouldCallSubmitUrlLookup(this.authRoles())) {
      return { podcastId: undefined as string | undefined, podcastName: undefined as string | undefined };
    }
    return generalDropSeries(await this.lookupSubmitUrl(href));
  }

  private async lookupSubmitUrl(href: string) {
    try {
      return await this.submitLookup.lookup(href);
    } catch {
      return 'error' as const;
    }
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
