import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  PLATFORM_ID,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DecimalPipe, isPlatformBrowser, KeyValue } from '@angular/common';
import { Homepage } from '../homepage.interface';
import { SiteService } from '../site.service';
import { ActivatedRoute, Params, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { HomepageService } from '../homepage.service';
import { HomepageEpisode } from '../homepage-episode.interface';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { SlotMachineCounterComponent } from '../slot-machine-counter/slot-machine-counter.component';
import { SearchBarComponent } from '../search-bar/search-bar.component';
import { PlayerService } from '../player.service';
import { episodeImageUrl } from '../search-result-links';
import { SearchDisplayEpisode } from '../search-result-links';
import { languageFlagBadgeForEpisode, LanguageFlagBadge } from '../language-flag';
import { pickObscureCults } from '../obscure-cults';
import { EpisodePosterComponent } from '../episode-poster/episode-poster.component';
import { SiteLoadingComponent } from '../site-loading/site-loading.component';
import { SubjectChipComponent } from '../subject-chip/subject-chip.component';
import { episodeEmbedOptions, playActionLabel } from '../episode-embed';
import { dateFromKey, dateKey } from '../homepage-date.util';
import { displayCatalogName } from '../display-catalog-name';
import { HeroCurationService } from '../hero-curation.service';
import { buildHeroSlides, HERO_POOL_SIZE, pruneCuratedIdsToWeek } from '../hero-slides';
import {
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
  private static readonly heroImageFallbackMs = 2500;
  private static readonly heroTransitionMs = 1200;
  /** Fade the current copy out before swapping so height/layout changes stay hidden. */
  private static readonly heroContentOutMs = 320;
  private static readonly subjectRailMinEpisodes = SUBJECT_RAIL_MIN_EPISODES;
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

  protected readonly heroIndex = signal(0);
  protected readonly heroPaused = signal(false);
  /** False while hero copy is fading out/in around a slide change. */
  protected readonly heroContentVisible = signal(true);
  /** True once the active slide background has decoded (or fallback timer fired). */
  protected readonly heroImageReady = signal(false);
  /** Two-layer crossfade: which stage is currently visible. */
  protected readonly heroFrontLayer = signal<'a' | 'b'>('a');
  protected readonly heroLayerA = signal<string | undefined>(undefined);
  protected readonly heroLayerB = signal<string | undefined>(undefined);
  /**
   * Per-layer Ken Burns. Kept on the outgoing layer through the crossfade so
   * removing the animation class cannot snap scale 1.18 → 1.08 mid-fade.
   */
  protected readonly heroKenBurnsA = signal(false);
  protected readonly heroKenBurnsB = signal(false);
  /** Ordered episode IDs from the hero-curation API (may include stale ids). */
  protected readonly curatedEpisodeIds = signal<string[]>([]);
  /** Ordered subject names pinned as homepage rails (may include stale names). */
  protected readonly curatedRailSubjects = signal<string[]>([]);
  /** Fade cues when the hero dash strip overflows its viewport. */
  protected readonly heroDotsOverflowStart = signal(false);
  protected readonly heroDotsOverflowEnd = signal(false);
  private readonly heroDotsViewport = viewChild<ElementRef<HTMLElement>>('heroDotsViewport');

  protected readonly displayCatalogName = displayCatalogName;

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
      bucket: HomepageApiComponent.heroTimeBucket(),
    });
  });

  protected readonly curatedIdSet = computed(() => new Set(this.curatedEpisodeIds()));

  protected readonly featured = computed(() => {
    const slides = this.heroSlides();
    if (slides.length === 0) {
      return undefined;
    }
    return slides[this.heroIndex() % slides.length];
  });

  protected readonly featuredIsCurated = computed(() => {
    const ep = this.featured();
    return !!ep && this.curatedIdSet().has(ep.id);
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

  /** Eligible subject groups from this week's episodes (popularity-sorted). */
  protected readonly subjectRailCandidates = computed(() =>
    collectSubjectRailCandidates(
      this.allEpisodes(),
      HomepageApiComponent.subjectRailMinEpisodes
    )
  );

  /** Full-week subject playlists from curator pins only (no popularity autofill). */
  protected readonly subjectRails = computed((): EpisodeRail[] =>
    buildSubjectRails(
      this.curatedRailSubjects(),
      this.subjectRailCandidates()
    ).map((rail) => ({
      id: `subject:${rail.subject}`,
      title: rail.subject,
      subject: rail.subject,
      episodes: rail.episodes,
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
  private heroCurationService = inject(HeroCurationService);
  private dialog = inject(MatDialog);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private heroTimer: ReturnType<typeof setInterval> | undefined;
  private heroContentTimer: ReturnType<typeof setTimeout> | undefined;
  private heroImageFallbackTimer: ReturnType<typeof setTimeout> | undefined;
  private heroKenBurnsClearTimer: ReturnType<typeof setTimeout> | undefined;
  private heroImageToken = 0;
  private backgroundRefreshTimer: ReturnType<typeof setInterval> | undefined;
  private lastBackgroundFetchAt = 0;
  private reduceMotion = false;
  /** True when local curated list was pruned for the week but KV was not yet updated. */
  private pendingKvPrune = false;
  private heroDotsOverflowTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly onDocumentVisibility = (): void => {
    if (!document.hidden) {
      this.maybeBackgroundRefresh();
    }
  };

  constructor() {
    // Keep the active dash centered in the strip when the hero rotates or the pool grows.
    afterRenderEffect(() => {
      const index = this.heroIndex();
      const slideCount = this.heroSlides().length;
      if (!isPlatformBrowser(this.platformId) || slideCount < 2) {
        return;
      }
      this.scrollActiveHeroDotIntoView(index);
    });
  }

  ngOnInit() {
    this.siteService.homepageRefresh$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      void this.loadHomepage();
    });
    this.populatePage();

    if (isPlatformBrowser(this.platformId)) {
      this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.startBackgroundRefresh();
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
        this.stopHeroCycle();
        this.stopBackgroundRefresh();
        this.clearHeroImageWait();
        if (this.heroDotsOverflowTimer) {
          clearTimeout(this.heroDotsOverflowTimer);
        }
        if (this.heroKenBurnsClearTimer) {
          clearTimeout(this.heroKenBurnsClearTimer);
        }
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

  isPromoted(episodeId: string): boolean {
    return this.curatedIdSet().has(episodeId);
  }

  isRailPinned(subject: string | undefined): boolean {
    return !!subject && this.curatedRailSubjectSet().has(subject);
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

  onHeroDotsScroll(): void {
    this.syncHeroDotsOverflow();
  }

  @HostListener('window:resize')
  onHeroDotsResize(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.scrollActiveHeroDotIntoView(this.heroIndex(), 'auto');
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

  async removeFeaturedFromHero(): Promise<void> {
    const feature = this.featured();
    if (!feature || !this.isCurator()) {
      return;
    }
    const ids = this.curatedEpisodeIds().filter((id) => id !== feature.id);
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
        this.clampHeroIndex();
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
    this.clampHeroIndex();
    try {
      const saved = await this.heroCurationService.setHeroCuration(ids);
      this.curatedEpisodeIds.set(saved.episodeIds);
      if (saved.railSubjects) {
        this.curatedRailSubjects.set(saved.railSubjects);
      }
      this.clampHeroIndex();
    } catch {
      this.curatedEpisodeIds.set(previous);
      this.clampHeroIndex();
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
        this.clampHeroIndex();
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
      this.clampHeroIndex();
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
      this.clampHeroIndex();
      this.pendingKvPrune = false;
    } catch (error) {
      console.warn('Homepage curation week prune failed to persist; local lists kept clean.', error);
      this.pendingKvPrune = true;
    }
  }

  private async loadHomepage(): Promise<void> {
    this.isLoading.set(true);
    this.isInError.set(false);
    this.stopHeroCycle();
    this.heroContentVisible.set(true);
    this.heroIndex.set(0);
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
      this.applyHomepage(homepageContent, { resetScrollProgress: true, resetHeroIndex: true });
      this.isLoading.set(false);
      this.isInError.set(false);
      this.syncHeroLayers(true);
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
    this.syncHeroLayers(true);
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

  private clampHeroIndex(): void {
    const n = this.heroSlides().length;
    if (n === 0) {
      this.heroIndex.set(0);
      return;
    }
    if (this.heroIndex() >= n) {
      this.heroIndex.set(this.heroIndex() % n);
    }
  }

  /** Smoothly keep the active dash in view when the strip is wider than its viewport. */
  private scrollActiveHeroDotIntoView(
    index: number,
    behavior: ScrollBehavior = this.reduceMotion ? 'auto' : 'smooth'
  ): void {
    const viewport = this.heroDotsViewport()?.nativeElement;
    if (!viewport) {
      return;
    }
    const active = viewport.querySelector<HTMLElement>(`[data-hero-dot="${index}"]`);
    if (!active) {
      this.syncHeroDotsOverflow();
      return;
    }

    const viewportWidth = viewport.clientWidth;
    const targetLeft =
      active.offsetLeft - (viewportWidth - active.offsetWidth) / 2;
    const maxScroll = Math.max(0, viewport.scrollWidth - viewportWidth);
    const nextLeft = Math.max(0, Math.min(targetLeft, maxScroll));

    if (Math.abs(viewport.scrollLeft - nextLeft) > 1) {
      viewport.scrollTo({ left: nextLeft, behavior });
    }
    // Overflow fades may lag smooth scroll; resync after the animation settles.
    this.syncHeroDotsOverflow();
    if (behavior === 'smooth') {
      if (this.heroDotsOverflowTimer) {
        clearTimeout(this.heroDotsOverflowTimer);
      }
      this.heroDotsOverflowTimer = setTimeout(() => this.syncHeroDotsOverflow(), 320);
    }
  }

  private syncHeroDotsOverflow(): void {
    const viewport = this.heroDotsViewport()?.nativeElement;
    if (!viewport) {
      this.heroDotsOverflowStart.set(false);
      this.heroDotsOverflowEnd.set(false);
      return;
    }
    const maxScroll = viewport.scrollWidth - viewport.clientWidth;
    if (maxScroll <= 1) {
      this.heroDotsOverflowStart.set(false);
      this.heroDotsOverflowEnd.set(false);
      return;
    }
    this.heroDotsOverflowStart.set(viewport.scrollLeft > 1);
    this.heroDotsOverflowEnd.set(viewport.scrollLeft < maxScroll - 1);
  }

  private transitionTo(index: number): void {
    if (index === this.heroIndex()) {
      return;
    }
    if (this.reduceMotion) {
      this.heroIndex.set(index);
      this.syncHeroLayers(true);
      this.heroContentVisible.set(true);
      this.beginHeroImageGate();
      return;
    }

    // 1) Fade current copy out while the old image is still fully visible.
    this.heroContentVisible.set(false);
    if (this.heroContentTimer) {
      clearTimeout(this.heroContentTimer);
    }
    this.heroContentTimer = setTimeout(() => {
      // 2) Swap copy + start image crossfade while text is invisible (no layout pop).
      this.heroIndex.set(index);
      this.syncHeroLayers(false);
      this.beginHeroImageGate();
      // 3) Fade the new copy in on the next frames, in step with the image bleed.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => this.heroContentVisible.set(true));
      });
    }, HomepageApiComponent.heroContentOutMs);
  }

  /** Seed or crossfade the two background layers for the active slide. */
  private syncHeroLayers(immediate: boolean): void {
    const url = this.featuredImage();
    if (immediate || this.reduceMotion) {
      if (this.heroKenBurnsClearTimer) {
        clearTimeout(this.heroKenBurnsClearTimer);
        this.heroKenBurnsClearTimer = undefined;
      }
      this.heroLayerA.set(url);
      this.heroLayerB.set(undefined);
      this.heroFrontLayer.set('a');
      this.heroKenBurnsA.set(!!url && !this.reduceMotion);
      this.heroKenBurnsB.set(false);
      return;
    }
    const front = this.heroFrontLayer();
    if (front === 'a') {
      // Incoming B starts without Ken Burns so the 1.08→1.18 run can restart.
      this.heroKenBurnsB.set(false);
      this.heroLayerB.set(url);
      // Flip after paint so the incoming layer starts at opacity 0.
      // Keep Ken Burns on A through the fade — dropping it snaps scale to 1.08.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.heroFrontLayer.set('b');
          this.scheduleOutgoingKenBurnsClear('a');
        });
      });
    } else {
      this.heroKenBurnsA.set(false);
      this.heroLayerA.set(url);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.heroFrontLayer.set('a');
          this.scheduleOutgoingKenBurnsClear('b');
        });
      });
    }
  }

  /**
   * After the opacity crossfade finishes, drop Ken Burns on the hidden layer
   * (and clear its image) so the next recycle can restart the zoom cleanly.
   */
  private scheduleOutgoingKenBurnsClear(outgoing: 'a' | 'b'): void {
    if (this.heroKenBurnsClearTimer) {
      clearTimeout(this.heroKenBurnsClearTimer);
    }
    this.heroKenBurnsClearTimer = setTimeout(() => {
      this.heroKenBurnsClearTimer = undefined;
      if (this.heroFrontLayer() === outgoing) {
        return;
      }
      if (outgoing === 'a') {
        this.heroKenBurnsA.set(false);
        this.heroLayerA.set(undefined);
      } else {
        this.heroKenBurnsB.set(false);
        this.heroLayerB.set(undefined);
      }
    }, HomepageApiComponent.heroTransitionMs);
  }

  private beginHeroImageGate(): void {
    this.clearHeroImageWait();
    this.heroImageReady.set(false);
    if (!isPlatformBrowser(this.platformId)) {
      this.heroImageReady.set(true);
      this.enableKenBurnsOnFront();
      return;
    }
    const url = this.featuredImage();
    const token = ++this.heroImageToken;
    if (!url) {
      this.heroImageReady.set(true);
      this.enableKenBurnsOnFront();
      return;
    }

    this.heroImageFallbackTimer = setTimeout(() => {
      if (token === this.heroImageToken) {
        this.heroImageReady.set(true);
        this.enableKenBurnsOnFront();
      }
    }, HomepageApiComponent.heroImageFallbackMs);

    const img = new Image();
    const markReady = () => {
      if (token !== this.heroImageToken) {
        return;
      }
      this.clearHeroImageWait();
      this.heroImageReady.set(true);
      this.enableKenBurnsOnFront();
    };
    img.onload = () => {
      if (typeof img.decode === 'function') {
        img.decode().then(markReady, markReady);
      } else {
        markReady();
      }
    };
    img.onerror = markReady;
    img.src = url;
    if (img.complete) {
      markReady();
    }
  }

  /** Start (or restart) Ken Burns only on the visible front layer. */
  private enableKenBurnsOnFront(): void {
    if (this.reduceMotion) {
      return;
    }
    if (this.heroFrontLayer() === 'a') {
      this.heroKenBurnsA.set(true);
    } else {
      this.heroKenBurnsB.set(true);
    }
  }

  private clearHeroImageWait(): void {
    if (this.heroImageFallbackTimer) {
      clearTimeout(this.heroImageFallbackTimer);
      this.heroImageFallbackTimer = undefined;
    }
  }

  private startHeroCycle(): void {
    this.stopHeroCycle();
    if (!isPlatformBrowser(this.platformId) || this.reduceMotion) {
      this.heroImageReady.set(true);
      return;
    }
    if (this.heroSlides().length < 2) {
      this.beginHeroImageGate();
      return;
    }
    this.beginHeroImageGate();
    let elapsed = 0;
    const tickMs = 250;
    this.heroTimer = setInterval(() => {
      if (this.heroPaused() || !this.heroImageReady()) {
        return;
      }
      elapsed += tickMs;
      if (elapsed < HomepageApiComponent.heroIntervalMs) {
        return;
      }
      elapsed = 0;
      const n = this.heroSlides().length;
      if (n < 2) {
        return;
      }
      this.transitionTo((this.heroIndex() + 1) % n);
    }, tickMs);
  }

  private restartHeroCycle(): void {
    this.startHeroCycle();
  }

  private stopHeroCycle(): void {
    if (this.heroTimer) {
      clearInterval(this.heroTimer);
      this.heroTimer = undefined;
    }
    if (this.heroContentTimer) {
      clearTimeout(this.heroContentTimer);
      this.heroContentTimer = undefined;
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

  /** Expose pool size for template/docs; selection logic lives in hero-slides.ts. */
  protected readonly heroPoolSize = HERO_POOL_SIZE;
}
