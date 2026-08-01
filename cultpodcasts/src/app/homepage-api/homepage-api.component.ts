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
import { PlayerService } from '../player.service';
import { episodeImageUrl } from '../search-result-links';
import { SearchDisplayEpisode } from '../search-result-links';
import { pickObscureCults } from '../obscure-cults';
import { SiteLoadingComponent } from '../site-loading/site-loading.component';
import { startEpisodePlayback } from '../episode-embed';
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
  normalizeRailOrder,
  parseDayRailOffset,
  subjectEntries,
  toggleSubjectInRailOrder,
} from '../rail-order';
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
  /**
   * Ordered homepage rails: relative day slots (`day:0` = n, `day:1` = n−1, …)
   * mixed with pinned subject names (may include stale entries).
   */
  protected readonly curatedRailSubjects = signal<string[]>([]);
  protected readonly curatedUpdatedAt = signal<string | null>(null);

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
    () => new Set(subjectEntries(this.curatedRailSubjects()))
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
    const weekKeys = this.weekDayKeysNewestFirst();
    const dayRails = weekKeys.map((key) => {
      const episodes = g[key];
      if (!episodes?.length) {
        return undefined;
      }
      const d = this.ToDate(key);
      return {
        id: `day:${key}`,
        title: `${this.Weekday[d.getDay()]} ${d.getDate()} ${this.Month[d.getMonth()]}`,
        // Day rails have no "Browse all" destination — show the full progressive window.
        episodes,
      } satisfies EpisodeRail;
    });

    const subjectByName = new Map(
      this.subjectRails().map((rail) => [rail.subject!, rail])
    );
    const eligible = this.subjectRailCandidates().map((c) => c.subject);
    const { order } = normalizeRailOrder(
      this.curatedRailSubjects(),
      weekKeys.length,
      eligible
    );

    const usedDays = new Set<number>();
    const usedSubjects = new Set<string>();
    const result: EpisodeRail[] = [];

    for (const entry of order) {
      const offset = parseDayRailOffset(entry);
      if (offset !== null) {
        const day = dayRails[offset];
        if (!day || usedDays.has(offset)) {
          continue;
        }
        usedDays.add(offset);
        result.push(day);
        continue;
      }
      const subject = subjectByName.get(entry);
      if (!subject || usedSubjects.has(entry)) {
        continue;
      }
      usedSubjects.add(entry);
      result.push(subject);
    }

    for (let offset = 0; offset < dayRails.length; offset++) {
      const day = dayRails[offset];
      if (day && !usedDays.has(offset)) {
        result.push(day);
      }
    }

    return result;
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
    startEpisodePlayback(episode, (playable) => this.playerService.play(playable));
  }

  async togglePromote(episode: SearchDisplayEpisode): Promise<void> {
    if (!this.isCurator()) {
      return;
    }
    const previous = this.curatedEpisodeIds();
    const previousUpdatedAt = this.curatedUpdatedAt();
    const wantPromoted = !previous.includes(episode.id);
    this.curatedEpisodeIds.set(
      wantPromoted
        ? [episode.id, ...previous.filter((id) => id !== episode.id)]
        : previous.filter((id) => id !== episode.id)
    );
    try {
      const saved = await this.heroCurationService.toggleEpisode(
        episode.id,
        previous,
        previousUpdatedAt
      );
      this.curatedEpisodeIds.set(saved.episodeIds);
      this.curatedUpdatedAt.set(saved.updatedAt);
      if (saved.railSubjects) {
        this.curatedRailSubjects.set(saved.railSubjects);
      }
    } catch {
      this.curatedEpisodeIds.set(previous);
      this.curatedUpdatedAt.set(previousUpdatedAt);
    }
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
        updatedAt: this.curatedUpdatedAt(),
      },
      ...this.manageDialogOptions(),
    });
    ref.afterClosed().subscribe((result: HeroManageDialogResult | undefined) => {
      if (result?.episodeIds) {
        this.curatedEpisodeIds.set(result.episodeIds);
      }
      if (result?.updatedAt !== undefined) {
        this.curatedUpdatedAt.set(result.updatedAt ?? null);
      }
    });
  }

  async toggleRailPin(subject: string | undefined, event?: Event): Promise<void> {
    event?.preventDefault();
    event?.stopPropagation();
    if (!subject || !this.isCurator()) {
      return;
    }
    const eligible = this.subjectRailCandidates().map((c) => c.subject);
    const { order } = normalizeRailOrder(
      this.curatedRailSubjects(),
      this.weekDayCount(),
      eligible
    );
    await this.persistRailSubjects(toggleSubjectInRailOrder(order, subject));
  }

  openManageRails(): void {
    if (!this.isCurator()) {
      return;
    }
    const candidates = this.subjectRailCandidates();
    const eligible = candidates.map((c) => c.subject);
    const dayKeys = this.weekDayKeysNewestFirst();
    const { order } = normalizeRailOrder(
      this.curatedRailSubjects(),
      dayKeys.length,
      eligible
    );
    const episodeCounts = Object.fromEntries(
      candidates.map((c) => [c.subject, c.episodes.length])
    );
    const byDay = new Map<string, number>();
    for (const episode of this.allEpisodes()) {
      const key = dateKey(episode.release as Date);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    const dayEpisodeCounts = dayKeys.map((key) => byDay.get(key) ?? 0);

    const ref = this.dialog.open(RailsManageDialogComponent, {
      data: {
        order,
        eligible,
        episodeCounts,
        dayEpisodeCounts,
        updatedAt: this.curatedUpdatedAt(),
      },
      ...this.manageDialogOptions(),
    });
    ref.afterClosed().subscribe((result: RailsManageDialogResult | undefined) => {
      if (result?.railSubjects) {
        this.curatedRailSubjects.set(result.railSubjects);
      }
      if (result?.updatedAt !== undefined) {
        this.curatedUpdatedAt.set(result.updatedAt ?? null);
      }
    });
  }

  private manageDialogOptions(): {
    width: string;
    maxWidth: string;
    maxHeight: string;
    autoFocus: 'dialog';
    panelClass: string;
    enterAnimationDuration?: number;
    exitAnimationDuration?: number;
  } {
    const cheapMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 900px), (hover: none) and (pointer: coarse)').matches;
    return {
      width: '520px',
      maxWidth: '94vw',
      maxHeight: '90dvh',
      autoFocus: 'dialog',
      panelClass: 'flix-manage-dialog',
      ...(cheapMotion
        ? { enterAnimationDuration: 0, exitAnimationDuration: 0 }
        : {}),
    };
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
    const previousUpdatedAt = this.curatedUpdatedAt();
    this.curatedEpisodeIds.set(ids);
    try {
      const saved = await this.heroCurationService.setHeroCuration(
        ids,
        previousUpdatedAt
      );
      this.curatedEpisodeIds.set(saved.episodeIds);
      this.curatedUpdatedAt.set(saved.updatedAt);
      if (saved.railSubjects) {
        this.curatedRailSubjects.set(saved.railSubjects);
      }
    } catch {
      this.curatedEpisodeIds.set(previous);
      this.curatedUpdatedAt.set(previousUpdatedAt);
    }
  }

  private async persistRailSubjects(subjects: string[]): Promise<void> {
    const previous = this.curatedRailSubjects();
    const previousUpdatedAt = this.curatedUpdatedAt();
    this.curatedRailSubjects.set(subjects);
    try {
      const saved = await this.heroCurationService.setRailSubjects(
        subjects,
        previousUpdatedAt
      );
      this.curatedRailSubjects.set(saved.railSubjects);
      this.curatedUpdatedAt.set(saved.updatedAt);
      if (saved.episodeIds) {
        this.curatedEpisodeIds.set(saved.episodeIds);
      }
    } catch {
      this.curatedRailSubjects.set(previous);
      this.curatedUpdatedAt.set(previousUpdatedAt);
    }
  }

  private async fetchCuration(): Promise<void> {
    const curation = await this.heroCurationService.getHeroCuration();
    this.curatedEpisodeIds.set(curation.episodeIds ?? []);
    this.curatedRailSubjects.set(curation.railSubjects ?? []);
    this.curatedUpdatedAt.set(curation.updatedAt ?? null);
  }

  /**
   * Drop curated picks / pinned rails that left the current homepage week window
   * for local display only. Server cron (every 6h) owns Durable Object prune writes.
   */
  private weekDayCount(): number {
    const keys = new Set<string>();
    for (const episode of this.allEpisodes()) {
      keys.add(dateKey(episode.release as Date));
    }
    return keys.size;
  }

  private weekDayKeysNewestFirst(): string[] {
    const keys = new Set<string>();
    for (const episode of this.allEpisodes()) {
      keys.add(dateKey(episode.release as Date));
    }
    return [...keys].sort((a, b) => this.descDateKey(a, b));
  }

  private pruneCurationToCurrentWeek(): void {
    const rawEpisodes = this.curatedEpisodeIds();
    const episodePrune = pruneCuratedIdsToWeek(rawEpisodes, this.allEpisodes());
    if (episodePrune.pruned) {
      this.curatedEpisodeIds.set(episodePrune.ids);
    }

    const rawRails = this.curatedRailSubjects();
    const railPrune = pruneRailSubjectsToWeek(
      rawRails,
      this.subjectRailCandidates(),
      this.weekDayCount()
    );
    if (railPrune.pruned) {
      this.curatedRailSubjects.set(railPrune.subjects);
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
