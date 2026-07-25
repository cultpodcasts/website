import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { isPlatformBrowser } from '@angular/common';
import { Homepage } from '../homepage.interface';
import { SiteService } from '../site.service';
import { ActivatedRoute, Params } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { HomepageService } from '../homepage.service';
import { HomepageEpisode } from '../homepage-episode.interface';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { SearchBarComponent } from '../search-bar/search-bar.component';
import { PlayerService } from '../player.service';
import { episodeImageUrl } from '../search-result-links';
import { SearchDisplayEpisode } from '../search-result-links';
import { pickObscureCults } from '../obscure-cults';
import { SiteLoadingComponent } from '../site-loading/site-loading.component';
import { episodeEmbedOptions } from '../episode-embed';
import { dateFromKey, dateKey } from '../homepage-date.util';
import { displayCatalogName } from '../display-catalog-name';
import { HeroCurationService } from '../hero-curation.service';
import { buildHeroSlides, pruneCuratedIdsToWeek } from '../hero-slides';
import {
  RAIL_DISPLAY_SIZE,
  SUBJECT_RAIL_MIN_EPISODES,
  buildSubjectRails,
  collectSubjectRailCandidates,
  pruneRailSubjectsToWeek,
} from '../rail-subjects';
import {
  HeroManageDialogComponent,
  HeroManageDialogResult,
} from '../hero-manage-dialog/hero-manage-dialog.component';
import {
  RailsManageDialogComponent,
  RailsManageDialogResult,
} from '../rails-manage-dialog/rails-manage-dialog.component';
import { HomepageHeroComponent } from '../homepage-hero/homepage-hero.component';
import { HomepageCatalogueComponent } from '../homepage-catalogue/homepage-catalogue.component';
import { HomepageDiscoverRailComponent } from '../homepage-discover-rail/homepage-discover-rail.component';
import { EpisodeRailComponent } from '../episode-rail/episode-rail.component';

export interface EpisodeRail {
  id: string;
  title: string;
  episodes: HomepageEpisode[];
  /** When set, rail title links to /subject/:subject */
  subject?: string;
}

@Component({
  selector: 'app-homepage-api',
  imports: [
    MatButtonModule,
    SearchBarComponent,
    SiteLoadingComponent,
    HomepageHeroComponent,
    HomepageCatalogueComponent,
    HomepageDiscoverRailComponent,
    EpisodeRailComponent,
  ],
  templateUrl: './homepage-api.component.html',
  styleUrl: './homepage-api.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomepageApiComponent {
  private static readonly subjectRailMinEpisodes = SUBJECT_RAIL_MIN_EPISODES;
  private static readonly railDisplaySize = RAIL_DISPLAY_SIZE;
  private static readonly obscureCultCount = 12;
  /** Stable pool reshuffle cadence — changes every 3 hours without flicker on every CD cycle. */
  private static readonly heroBucketMs = 3 * 60 * 60 * 1000;
  /** Background freshness: cadence for the homepage staying open unattended. */
  private static readonly backgroundRefreshIntervalMs = 20 * 60 * 1000;
  /** Floor between any two fetches (interval or visibility-triggered) so a tab-switch flurry can't spam the API. */
  private static readonly minBackgroundRefreshGapMs = 5 * 60 * 1000;

  protected grouped = signal<{ [key: string]: HomepageEpisode[] }>({});
  private allEpisodes = signal<HomepageEpisode[]>([]);
  private visibleCount: number = 0;
  private hasStartedScrolling: boolean = false;
  protected weekEpisodeCount = signal<number | undefined>(undefined);
  protected isLoading = signal<boolean>(true);
  protected isInError = signal<boolean>(false);
  protected readonly playerService = inject(PlayerService);
  readonly Weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  readonly Month = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  protected homepage = signal<Homepage | undefined>(undefined);
  protected episodeCount = signal<number | undefined>(undefined);
  protected totalDurationDays = signal<string>('');
  readonly episodeCountBaseline = 80000;
  protected auth = inject(AuthServiceWrapper);
  protected isSignedIn = toSignal(this.auth.isSignedIn, { initialValue: false });
  protected authRoles = toSignal(this.auth.roles, { initialValue: [] as string[] });
  protected readonly isCurator = computed(() => this.authRoles().includes('Curator'));
  readonly renderConfig = {
    initialBlockSize: 40,
    firstScrollBlockSize: 80,
    nearEndBlockSize: 80,
    nearEndThresholdPixels: 1200,
  };

  /** Ordered episode IDs from the hero-curation API (may include stale ids). */
  protected readonly curatedEpisodeIds = signal<string[]>([]);
  /** Ordered subject names pinned as homepage rails (may include stale names). */
  protected readonly curatedRailSubjects = signal<string[]>([]);

  protected readonly displayCatalogName = displayCatalogName;

  protected readonly heroTimeBucket = computed(() => HomepageApiComponent.heroTimeBucket());

  /**
   * Billboard slides: curated picks first (in order), autofilled from the week-wide
   * recent / subject / Discover interleave when curated count is under the pool size.
   */
  protected readonly heroSlides = computed((): HomepageEpisode[] => {
    const all = this.allEpisodes();
    if (all.length === 0) {
      return [];
    }
    return buildHeroSlides(this.curatedEpisodeIds(), all, {
      subjectRails: this.subjectRails(),
      obscureCults: this.obscureCults(),
      bucket: this.heroTimeBucket(),
    });
  });

  protected readonly curatedIdSet = computed(() => new Set(this.curatedEpisodeIds()));

  protected readonly playingEpisodeId = computed(() => this.playerService.episode()?.id);

  /** Eligible subject groups from this week's episodes (popularity-sorted). */
  protected readonly subjectRailCandidates = computed(() =>
    collectSubjectRailCandidates(
      this.allEpisodes(),
      HomepageApiComponent.subjectRailMinEpisodes
    )
  );

  /** Subject playlists from curator pins only (no popularity autofill). */
  protected readonly subjectRails = computed((): EpisodeRail[] =>
    buildSubjectRails(
      this.curatedRailSubjects(),
      this.subjectRailCandidates()
    ).map((rail) => ({
      id: `subject:${rail.subject}`,
      title: rail.subject,
      subject: rail.subject,
      // Cap DOM: full week list stays on candidates for counts / prune; scroller shows a page.
      episodes: rail.episodes.slice(0, HomepageApiComponent.railDisplaySize),
    }))
  );

  protected readonly curatedRailSubjectSet = computed(
    () => new Set(this.curatedRailSubjects())
  );

  /** Lesser-known named groups from this week's episodes. */
  protected readonly obscureCults = computed(() =>
    pickObscureCults(
      this.allEpisodes(),
      (episode) => episodeImageUrl(episode)?.toString(),
      { limit: HomepageApiComponent.obscureCultCount }
    )
  );

  protected readonly rails = computed((): EpisodeRail[] => {
    const g = this.grouped();
    const keys = Object.keys(g).sort((a, b) => this.descDateKey(a, b));
    const dayRails = keys.map((key) => {
      const d = this.ToDate(key);
      return {
        id: `day:${key}`,
        title: `${this.Weekday[d.getDay()]} ${d.getDate()} ${this.Month[d.getMonth()]}`,
        episodes: g[key].slice(0, HomepageApiComponent.railDisplaySize),
      } satisfies EpisodeRail;
    });

    const subjects = this.subjectRails();
    if (subjects.length === 0 || dayRails.length === 0) {
      return [...dayRails, ...subjects];
    }

    // Lead with the newest day, then subject playlists, then remaining days.
    return [dayRails[0], ...subjects, ...dayRails.slice(1)];
  });

  private siteService = inject(SiteService);
  private homepageService = inject(HomepageService);
  private heroCurationService = inject(HeroCurationService);
  private dialog = inject(MatDialog);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private backgroundRefreshTimer: ReturnType<typeof setInterval> | undefined;
  private lastBackgroundFetchAt = 0;
  /** True when local curated list was pruned for the week but KV was not yet updated. */
  private pendingKvPrune = false;
  private readonly onDocumentVisibility = (): void => {
    if (!document.hidden) {
      this.maybeBackgroundRefresh();
    }
  };
  private scrollFrame = 0;
  /**
   * Bound outside Angular's event manager on purpose: in a zoneless app every listener
   * invocation schedules a change-detection pass, so a `@HostListener` here would run one
   * per scroll event. Only `loadMoreEpisodes` writes signals, so CD now runs when the
   * visible set actually grows.
   */
  private readonly onScrollEvent = (): void => {
    if (this.scrollFrame) {
      return;
    }
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = 0;
      this.onWindowScroll();
    });
  };

  ngOnInit() {
    this.siteService.homepageRefresh$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      void this.loadHomepage();
    });
    this.populatePage();

    if (isPlatformBrowser(this.platformId)) {
      this.startBackgroundRefresh();
      this.startScrollWatch();
      // If curation was pruned for display while anonymous, persist once a Curator signs in.
      this.auth.roles.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((roles) => {
        if (roles.includes('Curator') && this.pendingKvPrune) {
          this.pendingKvPrune = false;
          void this.quietPersistPrune({
            episodeIds: this.curatedEpisodeIds(),
            railSubjects: this.curatedRailSubjects(),
          });
        }
      });
      this.destroyRef.onDestroy(() => {
        this.stopBackgroundRefresh();
        this.stopScrollWatch();
      });
    }
  }

  onWindowScroll(): void {
    if (!this.homepage() || this.isLoading() || this.isInError() || this.allEpisodes().length === 0) {
      return;
    }

    if (!this.hasStartedScrolling && window.scrollY > 0) {
      this.hasStartedScrolling = true;
      this.loadMoreEpisodes(this.renderConfig.firstScrollBlockSize);
      return;
    }

    const currentBottom = window.innerHeight + window.scrollY;
    const documentHeight = document.documentElement.scrollHeight;
    const isNearEnd = currentBottom >= documentHeight - this.renderConfig.nearEndThresholdPixels;

    if (isNearEnd) {
      this.loadMoreEpisodes(this.renderConfig.nearEndBlockSize);
    }
  }

  isRailPinned(subject: string | undefined): boolean {
    return !!subject && this.curatedRailSubjectSet().has(subject);
  }

  playEpisode(episode: HomepageEpisode | SearchDisplayEpisode, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (episodeEmbedOptions(episode).length === 0) {
      return;
    }
    this.playerService.play(episode);
  }

  async togglePromote(episode: SearchDisplayEpisode): Promise<void> {
    if (!this.isCurator()) {
      return;
    }
    const ids = [...this.curatedEpisodeIds()];
    const idx = ids.indexOf(episode.id);
    if (idx >= 0) {
      ids.splice(idx, 1);
    } else {
      // Newest star leads the hero rotation.
      ids.unshift(episode.id);
    }
    await this.persistCuration(ids);
  }

  async removeFeaturedFromHero(episodeId: string): Promise<void> {
    if (!this.isCurator() || !episodeId) {
      return;
    }
    const ids = this.curatedEpisodeIds().filter((id) => id !== episodeId);
    await this.persistCuration(ids);
  }

  openManageHero(): void {
    if (!this.isCurator()) {
      return;
    }
    const curatedSet = this.curatedIdSet();
    const slides = this.heroSlides();
    const curated = slides.filter((s) => curatedSet.has(s.id));
    // Prefer curated order from the API list, not slide order after resolve.
    const byId = new Map(this.allEpisodes().map((ep) => [ep.id, ep]));
    const curatedOrdered = this.curatedEpisodeIds()
      .map((id) => byId.get(id))
      .filter((ep): ep is HomepageEpisode => !!ep);
    const autofilled = slides.filter((s) => !curatedSet.has(s.id));

    const ref = this.dialog.open(HeroManageDialogComponent, {
      data: {
        curated: curatedOrdered.length > 0 ? curatedOrdered : curated,
        autofilled,
      },
      width: '520px',
      maxWidth: '94vw',
      autoFocus: 'dialog',
    });
    ref.afterClosed().subscribe((result: HeroManageDialogResult | undefined) => {
      if (result?.saved && result.episodeIds) {
        this.curatedEpisodeIds.set(result.episodeIds);
      }
    });
  }

  async toggleRailPin(subject: string | undefined, event?: Event): Promise<void> {
    event?.preventDefault();
    event?.stopPropagation();
    if (!subject || !this.isCurator()) {
      return;
    }
    const subjects = [...this.curatedRailSubjects()];
    const idx = subjects.indexOf(subject);
    if (idx >= 0) {
      subjects.splice(idx, 1);
    } else {
      subjects.push(subject);
    }
    await this.persistRailSubjects(subjects);
  }

  openManageRails(): void {
    if (!this.isCurator()) {
      return;
    }
    const candidates = this.subjectRailCandidates();
    const pinned = this.curatedRailSubjects().filter((subject) =>
      candidates.some((c) => c.subject === subject)
    );
    const eligible = candidates.map((c) => c.subject);
    const episodeCounts = Object.fromEntries(
      candidates.map((c) => [c.subject, c.episodes.length])
    );

    const ref = this.dialog.open(RailsManageDialogComponent, {
      data: {
        pinned,
        eligible,
        episodeCounts,
      },
      width: '520px',
      maxWidth: '94vw',
      autoFocus: 'dialog',
    });
    ref.afterClosed().subscribe((result: RailsManageDialogResult | undefined) => {
      if (result?.saved && result.railSubjects) {
        this.curatedRailSubjects.set(result.railSubjects);
      }
    });
  }

  populatePage() {
    combineLatest([this.route.params, this.route.queryParams], (params: Params, queryParams: Params) => ({
      params,
      queryParams,
    }))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async () => {
        this.siteService.setQuery(null);
        this.siteService.setPodcast(null);
        this.siteService.setSubject(null);
        await this.loadHomepage();
      });
  }

  private async persistCuration(ids: string[]): Promise<void> {
    const previous = this.curatedEpisodeIds();
    this.curatedEpisodeIds.set(ids);
    try {
      const saved = await this.heroCurationService.setHeroCuration(ids);
      this.curatedEpisodeIds.set(saved.episodeIds);
      if (saved.railSubjects) {
        this.curatedRailSubjects.set(saved.railSubjects);
      }
    } catch {
      this.curatedEpisodeIds.set(previous);
    }
  }

  private async persistRailSubjects(subjects: string[]): Promise<void> {
    const previous = this.curatedRailSubjects();
    this.curatedRailSubjects.set(subjects);
    try {
      const saved = await this.heroCurationService.setRailSubjects(subjects);
      this.curatedRailSubjects.set(saved.railSubjects);
      if (saved.episodeIds) {
        this.curatedEpisodeIds.set(saved.episodeIds);
      }
    } catch {
      this.curatedRailSubjects.set(previous);
    }
  }

  private async fetchCuration(): Promise<void> {
    const curation = await this.heroCurationService.getHeroCuration();
    this.curatedEpisodeIds.set(curation.episodeIds ?? []);
    this.curatedRailSubjects.set(curation.railSubjects ?? []);
  }

  /**
   * Drop curated picks / pinned rails that left the current homepage week window.
   * Always updates local display; when a Curator is signed in, quietly PUT
   * the cleaned lists so KV stays in sync (week-window drop is intentional).
   */
  private pruneCurationToCurrentWeek(): void {
    const rawEpisodes = this.curatedEpisodeIds();
    const episodePrune = pruneCuratedIdsToWeek(rawEpisodes, this.allEpisodes());
    if (episodePrune.pruned) {
      this.curatedEpisodeIds.set(episodePrune.ids);
    }

    const rawRails = this.curatedRailSubjects();
    const railPrune = pruneRailSubjectsToWeek(
      rawRails,
      this.subjectRailCandidates()
    );
    if (railPrune.pruned) {
      this.curatedRailSubjects.set(railPrune.subjects);
    }

    if (!episodePrune.pruned && !railPrune.pruned) {
      return;
    }
    if (this.isCurator()) {
      this.pendingKvPrune = false;
      void this.quietPersistPrune({
        episodeIds: episodePrune.pruned ? episodePrune.ids : undefined,
        railSubjects: railPrune.pruned ? railPrune.subjects : undefined,
      });
    } else {
      this.pendingKvPrune = true;
    }
  }

  private async quietPersistPrune(update: {
    episodeIds?: string[];
    railSubjects?: string[];
  }): Promise<void> {
    try {
      const saved = await this.heroCurationService.setHomepageCuration(update);
      this.curatedEpisodeIds.set(saved.episodeIds ?? this.curatedEpisodeIds());
      this.curatedRailSubjects.set(saved.railSubjects ?? this.curatedRailSubjects());
      this.pendingKvPrune = false;
    } catch (error) {
      console.warn('Homepage curation week prune failed to persist; local lists kept clean.', error);
      this.pendingKvPrune = true;
    }
  }

  private async loadHomepage(): Promise<void> {
    this.isLoading.set(true);
    this.isInError.set(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0 });
    }

    let homepageContent: Homepage | undefined;
    try {
      const [homepage] = await Promise.all([
        this.homepageService.getHomepageFromApi(),
        this.fetchCuration(),
      ]);
      homepageContent = homepage;
      this.lastBackgroundFetchAt = Date.now();
    } catch (error) {
      console.error(error);
      this.isLoading.set(false);
      this.isInError.set(true);
      return;
    }

    if (homepageContent) {
      this.applyHomepage(homepageContent, { resetScrollProgress: true });
      this.isLoading.set(false);
      this.isInError.set(false);
    } else {
      this.isLoading.set(false);
      this.isInError.set(true);
    }
  }

  /** Quiet re-fetch while the tab stays open — no spinner, no scroll jump. */
  private async refreshHomepageInBackground(): Promise<void> {
    if (this.isLoading()) {
      return;
    }
    let homepageContent: Homepage | undefined;
    try {
      const [homepage] = await Promise.all([
        this.homepageService.getHomepageFromApi(),
        this.fetchCuration(),
      ]);
      homepageContent = homepage;
      this.lastBackgroundFetchAt = Date.now();
    } catch (error) {
      console.error(error);
      return;
    }
    if (!homepageContent) {
      return;
    }
    this.applyHomepage(homepageContent, { resetScrollProgress: false });
  }

  private applyHomepage(
    homepageContent: Homepage,
    options: { resetScrollProgress: boolean }
  ): void {
    this.homepage.set(homepageContent);
    this.episodeCount.set(homepageContent.episodeCount);
    this.totalDurationDays.set(homepageContent.totalDuration.split('.')[0]);
    this.weekEpisodeCount.set(homepageContent.recentEpisodes.length);
    if (options.resetScrollProgress) {
      this.hasStartedScrolling = false;
      this.visibleCount = 0;
    }
    this.allEpisodes.set(
      homepageContent.recentEpisodes.map((item) => ({
        ...item,
        release: new Date(item.release),
      }))
    );
    // Week-window drop: curated picks that left recentEpisodes fall out locally
    // (and persist when a Curator is signed in).
    this.pruneCurationToCurrentWeek();
    if (options.resetScrollProgress) {
      this.loadMoreEpisodes(this.renderConfig.initialBlockSize);
    } else if (this.visibleCount > 0) {
      const keep = this.visibleCount;
      this.visibleCount = 0;
      this.loadMoreEpisodes(keep);
    } else {
      this.loadMoreEpisodes(this.renderConfig.initialBlockSize);
    }
  }

  private startScrollWatch(): void {
    window.addEventListener('scroll', this.onScrollEvent, { passive: true });
  }

  private stopScrollWatch(): void {
    window.removeEventListener('scroll', this.onScrollEvent);
    if (this.scrollFrame) {
      cancelAnimationFrame(this.scrollFrame);
      this.scrollFrame = 0;
    }
  }

  private startBackgroundRefresh(): void {
    this.stopBackgroundRefresh();
    document.addEventListener('visibilitychange', this.onDocumentVisibility);
    this.backgroundRefreshTimer = setInterval(
      () => this.maybeBackgroundRefresh(),
      HomepageApiComponent.backgroundRefreshIntervalMs
    );
  }

  private stopBackgroundRefresh(): void {
    if (this.backgroundRefreshTimer) {
      clearInterval(this.backgroundRefreshTimer);
      this.backgroundRefreshTimer = undefined;
    }
    document.removeEventListener('visibilitychange', this.onDocumentVisibility);
  }

  private maybeBackgroundRefresh(): void {
    if (!isPlatformBrowser(this.platformId) || document.hidden || this.isLoading()) {
      return;
    }
    const elapsed = Date.now() - this.lastBackgroundFetchAt;
    if (elapsed < HomepageApiComponent.minBackgroundRefreshGapMs) {
      return;
    }
    void this.refreshHomepageInBackground();
  }

  private static heroTimeBucket(now: Date = new Date()): number {
    return Math.floor(now.getTime() / HomepageApiComponent.heroBucketMs);
  }

  private loadMoreEpisodes(count: number): void {
    const episodes = this.allEpisodes();
    const nextVisibleCount = Math.min(this.visibleCount + count, episodes.length);
    if (nextVisibleCount === this.visibleCount) {
      return;
    }

    this.visibleCount = nextVisibleCount;
    const visibleEpisodes = episodes.slice(0, this.visibleCount);
    this.grouped.set(
      visibleEpisodes.reduce((group: { [key: string]: HomepageEpisode[] }, item) => {
        const releaseDate = item.release as Date;
        const releaseDateKey = dateKey(releaseDate);
        if (!group[releaseDateKey]) {
          group[releaseDateKey] = [];
        }
        group[releaseDateKey].push(item);
        return group;
      }, {})
    );
  }

  ToDate = (key: string) => dateFromKey(key);

  private descDateKey(a: string, b: string): number {
    const aD = this.ToDate(a);
    const bD = this.ToDate(b);
    if (aD > bD) return -1;
    if (aD < bD) return 1;
    return 0;
  }
}
