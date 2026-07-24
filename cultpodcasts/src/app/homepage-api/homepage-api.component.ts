import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DecimalPipe, isPlatformBrowser, KeyValue } from '@angular/common';
import { Homepage } from '../homepage.interface';
import { SiteService } from '../site.service';
import { ActivatedRoute, Params, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { HomepageService } from '../homepage.service';
import { HomepageEpisode } from '../homepage-episode.interface';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { SlotMachineCounterComponent } from '../slot-machine-counter/slot-machine-counter.component';
import { SearchBarComponent } from '../search-bar/search-bar.component';
import { PlayerService } from '../player.service';
import { episodeImageUrl } from '../search-result-links';
import { SearchDisplayEpisode } from '../search-result-links';
import { languageFlagBadgeForEpisode, LanguageFlagBadge } from '../language-flag';
import { isMetaSubject, pickObscureCults } from '../obscure-cults';
import { EpisodePosterComponent } from '../episode-poster/episode-poster.component';
import { SiteLoadingComponent } from '../site-loading/site-loading.component';
import { SubjectChipComponent } from '../subject-chip/subject-chip.component';
import { episodeEmbedOptions, playActionLabel } from '../episode-embed';
import { dateFromKey, dateKey } from '../homepage-date.util';
import { displayCatalogName } from '../display-catalog-name';

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
    DecimalPipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    SlotMachineCounterComponent,
    SearchBarComponent,
    EpisodePosterComponent,
    SiteLoadingComponent,
    SubjectChipComponent,
  ],
  templateUrl: './homepage-api.component.html',
  styleUrl: './homepage-api.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomepageApiComponent {
  private static readonly heroIntervalMs = 7500;
  private static readonly subjectRailCount = 6;
  private static readonly subjectRailMinEpisodes = 3;
  private static readonly obscureCultCount = 12;
  /** Hero pool draws across the past week — recent releases, subjects and Discover. */
  private static readonly heroPoolSize = 18;
  /** How many week-wide recent picks (time-bucket rotated, not always the absolute newest). */
  private static readonly heroRecentContribution = 10;
  private static readonly heroSubjectContribution = 6;
  private static readonly heroDiscoverContribution = 6;
  /** Recency window to rotate through before capping contribution (covers most of a busy week). */
  private static readonly heroRecentWindow = 48;
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
  readonly renderConfig = {
    initialBlockSize: 40,
    firstScrollBlockSize: 80,
    nearEndBlockSize: 80,
    nearEndThresholdPixels: 1200,
  };

  protected readonly heroIndex = signal(0);
  protected readonly heroPaused = signal(false);
  protected readonly heroAnimating = signal(false);

  protected readonly displayCatalogName = displayCatalogName;

  /**
   * Broad hero pool from this week's homepage episodes. Interleaves a time-bucketed walk
   * across recent releases (not only the absolute newest) with subject / Discover highlights
   * that are also offset by the bucket — so the billboard feels fresher across the day
   * without random flicker on every change-detection cycle. Pool is derived from the full
   * recentEpisodes payload, not the progressively-rendered rail view.
   */
  protected readonly heroSlides = computed((): HomepageEpisode[] => {
    const all = this.allEpisodes();
    if (all.length === 0) {
      return [];
    }

    const bucket = HomepageApiComponent.heroTimeBucket();
    const byRecency = all
      .slice()
      .sort((a, b) => (b.release as Date).getTime() - (a.release as Date).getTime());

    const recentWindow = byRecency.slice(0, HomepageApiComponent.heroRecentWindow);
    const recentSource = HomepageApiComponent.rotateTake(
      recentWindow,
      bucket * 3,
      HomepageApiComponent.heroRecentContribution
    );
    const subjectSource = this.subjectRails()
      .slice(0, HomepageApiComponent.heroSubjectContribution)
      .map((rail, i) => HomepageApiComponent.pickAtOffset(rail.episodes, bucket + i));
    const discoverSource = this.obscureCults()
      .slice(0, HomepageApiComponent.heroDiscoverContribution)
      .map((cult, i) => HomepageApiComponent.pickAtOffset(cult.episodes, bucket + i + 1));

    const seen = new Set<string>();
    const pool: HomepageEpisode[] = [];
    const add = (ep: HomepageEpisode | undefined): void => {
      if (!ep || seen.has(ep.id) || pool.length >= HomepageApiComponent.heroPoolSize) {
        return;
      }
      seen.add(ep.id);
      pool.push(ep);
    };

    // Interleave the three sources (recent / subject / discover) so early slides already
    // show variety, rather than running through one source before touching the next.
    const sources = [recentSource, subjectSource, discoverSource];
    for (let i = 0; pool.length < HomepageApiComponent.heroPoolSize && sources.some((s) => i < s.length); i++) {
      for (const source of sources) {
        if (i < source.length) {
          add(source[i]);
        }
      }
    }

    // Backfill from the rotated week window, then the full recency list.
    if (pool.length < HomepageApiComponent.heroPoolSize) {
      for (const ep of HomepageApiComponent.rotateTake(recentWindow, bucket, recentWindow.length)) {
        if (pool.length >= HomepageApiComponent.heroPoolSize) {
          break;
        }
        add(ep);
      }
    }
    if (pool.length < HomepageApiComponent.heroPoolSize) {
      for (const ep of byRecency) {
        if (pool.length >= HomepageApiComponent.heroPoolSize) {
          break;
        }
        add(ep);
      }
    }

    return pool;
  });

  protected readonly featured = computed(() => {
    const slides = this.heroSlides();
    if (slides.length === 0) {
      return undefined;
    }
    return slides[this.heroIndex() % slides.length];
  });

  protected readonly featuredImage = computed(() => {
    const ep = this.featured();
    return ep ? episodeImageUrl(ep)?.toString() : undefined;
  });

  protected readonly featuredDesc = computed(() => {
    const text = this.featured()?.episodeDescription ?? '';
    return text.length > 220 ? `${text.slice(0, 220).trim()}…` : text;
  });

  protected readonly featuredSubjects = computed(() => {
    const subjects = this.featured()?.subjects ?? [];
    return subjects.filter((s) => !s.startsWith('_')).slice(0, 4);
  });

  /** Full-week subject playlists (not limited to progressive day render). */
  protected readonly subjectRails = computed((): EpisodeRail[] => {
    const bySubject = new Map<string, HomepageEpisode[]>();
    for (const ep of this.allEpisodes()) {
      for (const raw of ep.subjects ?? []) {
        if (!raw || raw.startsWith('_') || isMetaSubject(raw)) {
          continue;
        }
        const list = bySubject.get(raw);
        if (list) {
          if (!list.some((e) => e.id === ep.id)) {
            list.push(ep);
          }
        } else {
          bySubject.set(raw, [ep]);
        }
      }
    }

    return [...bySubject.entries()]
      .filter(([, eps]) => eps.length >= HomepageApiComponent.subjectRailMinEpisodes)
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .slice(0, HomepageApiComponent.subjectRailCount)
      .map(([subject, episodes]) => ({
        id: `subject:${subject}`,
        title: subject,
        subject,
        episodes: episodes
          .slice()
          .sort((a, b) => (b.release as Date).getTime() - (a.release as Date).getTime()),
      }));
  });

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
        episodes: g[key],
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
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private heroTimer: ReturnType<typeof setInterval> | undefined;
  private heroAnimTimer: ReturnType<typeof setTimeout> | undefined;
  private backgroundRefreshTimer: ReturnType<typeof setInterval> | undefined;
  private lastBackgroundFetchAt = 0;
  private reduceMotion = false;
  private readonly onDocumentVisibility = (): void => {
    if (!document.hidden) {
      this.maybeBackgroundRefresh();
    }
  };

  ngOnInit() {
    this.siteService.homepageRefresh$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      void this.loadHomepage();
    });
    this.populatePage();

    if (isPlatformBrowser(this.platformId)) {
      this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.startBackgroundRefresh();
      this.destroyRef.onDestroy(() => {
        this.stopHeroCycle();
        this.stopBackgroundRefresh();
      });
    }
  }

  @HostListener('window:scroll')
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

  posterImage(episode: HomepageEpisode): string | undefined {
    return episodeImageUrl(episode)?.toString();
  }

  slideImage(episode: HomepageEpisode): string | undefined {
    return episodeImageUrl(episode)?.toString();
  }

  durationLabel(duration: string): string {
    return duration.startsWith('0') ? duration.substring(1) : duration;
  }

  canPlay(episode: HomepageEpisode | SearchDisplayEpisode): boolean {
    return episodeEmbedOptions(episode).length > 0;
  }

  playLabel(episode: HomepageEpisode | SearchDisplayEpisode): 'Watch' | 'Listen' {
    return playActionLabel(episode);
  }

  playEpisode(episode: HomepageEpisode | SearchDisplayEpisode, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.canPlay(episode)) {
      return;
    }
    this.playerService.play(episode);
    this.heroPaused.set(true);
  }

  isPlayingId(id: string): boolean {
    return this.playerService.episode()?.id === id;
  }

  /** Non-English language flag badge; undefined when English/unknown. */
  languageFlag(episode: HomepageEpisode): LanguageFlagBadge | undefined {
    return languageFlagBadgeForEpisode(episode);
  }

  pauseHero(): void {
    this.heroPaused.set(true);
  }

  resumeHero(): void {
    if (this.playerService.episode()) {
      return;
    }
    this.heroPaused.set(false);
  }

  goHero(index: number): void {
    const slides = this.heroSlides();
    if (slides.length === 0) {
      return;
    }
    this.transitionTo(index % slides.length);
    this.restartHeroCycle();
  }

  nextHero(): void {
    const n = this.heroSlides().length;
    if (n === 0) {
      return;
    }
    this.transitionTo((this.heroIndex() + 1) % n);
    this.restartHeroCycle();
  }

  prevHero(): void {
    const n = this.heroSlides().length;
    if (n === 0) {
      return;
    }
    this.transitionTo((this.heroIndex() - 1 + n) % n);
    this.restartHeroCycle();
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

  private async loadHomepage(): Promise<void> {
    this.isLoading.set(true);
    this.isInError.set(false);
    this.stopHeroCycle();
    this.heroIndex.set(0);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0 });
    }

    let homepageContent: Homepage | undefined;
    try {
      homepageContent = await this.homepageService.getHomepageFromApi();
      this.lastBackgroundFetchAt = Date.now();
    } catch (error) {
      console.error(error);
      this.isLoading.set(false);
      this.isInError.set(true);
      return;
    }

    if (homepageContent) {
      this.applyHomepage(homepageContent, { resetScrollProgress: true, resetHeroIndex: true });
      this.isLoading.set(false);
      this.isInError.set(false);
      this.startHeroCycle();
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
      homepageContent = await this.homepageService.getHomepageFromApi();
      this.lastBackgroundFetchAt = Date.now();
    } catch (error) {
      console.error(error);
      return;
    }
    if (!homepageContent) {
      return;
    }
    const prevFeaturedId = this.featured()?.id;
    this.applyHomepage(homepageContent, { resetScrollProgress: false, resetHeroIndex: false });
    const slides = this.heroSlides();
    if (slides.length === 0) {
      return;
    }
    const keepIndex = prevFeaturedId ? slides.findIndex((s) => s.id === prevFeaturedId) : -1;
    if (keepIndex >= 0) {
      this.heroIndex.set(keepIndex);
    } else {
      this.heroIndex.set(this.heroIndex() % slides.length);
    }
    this.startHeroCycle();
  }

  private applyHomepage(
    homepageContent: Homepage,
    options: { resetScrollProgress: boolean; resetHeroIndex: boolean }
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
    if (options.resetScrollProgress) {
      this.loadMoreEpisodes(this.renderConfig.initialBlockSize);
    } else if (this.visibleCount > 0) {
      const keep = this.visibleCount;
      this.visibleCount = 0;
      this.loadMoreEpisodes(keep);
    } else {
      this.loadMoreEpisodes(this.renderConfig.initialBlockSize);
    }
    if (options.resetHeroIndex) {
      const slides = this.heroSlides();
      const start =
        slides.length > 0 ? HomepageApiComponent.heroTimeBucket() % slides.length : 0;
      this.heroIndex.set(start);
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

  private static rotateTake<T>(items: T[], offset: number, count: number): T[] {
    if (items.length === 0 || count <= 0) {
      return [];
    }
    const start = ((offset % items.length) + items.length) % items.length;
    const take = Math.min(count, items.length);
    const out: T[] = [];
    for (let i = 0; i < take; i++) {
      out.push(items[(start + i) % items.length]);
    }
    return out;
  }

  private static pickAtOffset<T>(items: T[], offset: number): T | undefined {
    if (items.length === 0) {
      return undefined;
    }
    return items[((offset % items.length) + items.length) % items.length];
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

  private transitionTo(index: number): void {
    if (index === this.heroIndex()) {
      return;
    }
    this.heroAnimating.set(true);
    this.heroIndex.set(index);
    if (this.heroAnimTimer) {
      clearTimeout(this.heroAnimTimer);
    }
    this.heroAnimTimer = setTimeout(() => this.heroAnimating.set(false), 700);
  }

  private startHeroCycle(): void {
    this.stopHeroCycle();
    if (!isPlatformBrowser(this.platformId) || this.reduceMotion) {
      return;
    }
    if (this.heroSlides().length < 2) {
      return;
    }
    this.heroTimer = setInterval(() => {
      if (this.heroPaused()) {
        return;
      }
      const n = this.heroSlides().length;
      if (n < 2) {
        return;
      }
      this.transitionTo((this.heroIndex() + 1) % n);
    }, HomepageApiComponent.heroIntervalMs);
  }

  private restartHeroCycle(): void {
    this.startHeroCycle();
  }

  private stopHeroCycle(): void {
    if (this.heroTimer) {
      clearInterval(this.heroTimer);
      this.heroTimer = undefined;
    }
    if (this.heroAnimTimer) {
      clearTimeout(this.heroAnimTimer);
      this.heroAnimTimer = undefined;
    }
  }

  ToDate = (key: string) => dateFromKey(key);

  private descDateKey(a: string, b: string): number {
    const aD = this.ToDate(a);
    const bD = this.ToDate(b);
    if (aD > bD) return -1;
    if (aD < bD) return 1;
    return 0;
  }

  descDate = (a: KeyValue<string, HomepageEpisode[]>, b: KeyValue<string, HomepageEpisode[]>): number => {
    return this.descDateKey(a.key, b.key);
  };
}
