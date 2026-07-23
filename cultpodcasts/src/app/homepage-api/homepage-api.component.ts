import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, PLATFORM_ID, TransferState, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { isPlatformBrowser, isPlatformServer, KeyValue, KeyValuePipe } from '@angular/common';
import { Homepage } from '../homepage.interface';
import { SiteService } from '../site.service';
import { ActivatedRoute, Params, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { HomepageService } from '../homepage.service';
import { EpisodeImageComponent } from '../episode-image/episode-image.component';
import { HomepageEpisode } from "../homepage-episode.interface";
import { EpisodeLinksComponent } from "../episode-links/episode-links.component";
import { BookmarkComponent } from "../bookmark/bookmark.component";
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { SubjectsComponent } from "../subjects/subjects.component";
import { ClampableTextComponent } from '../clampable-text/clampable-text.component';
import { SlotMachineCounterComponent } from '../slot-machine-counter/slot-machine-counter.component';
import { FeatureSwitch } from '../feature-switch.enum';
import { FeatureSwtichService } from '../feature-switch-service';
import { HOMEPAGE_SSR_DATA, HOMEPAGE_SSR_STATE_KEY } from '../homepage-ssr.token';
import { PreProcessedHomepage } from '../preprocessed-homepage.interface';

@Component({
  selector: 'app-homepage-api',
  imports: [
    MatProgressBarModule,
    MatCardModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    KeyValuePipe,
    EpisodeImageComponent,
    EpisodeLinksComponent,
    BookmarkComponent,
    SubjectsComponent,
    ClampableTextComponent,
    SlotMachineCounterComponent
  ],
  templateUrl: './homepage-api.component.html',
  styleUrl: './homepage-api.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomepageApiComponent {
  protected grouped = signal<{ [key: string]: HomepageEpisode[] }>({});
  protected useSsrDayLabels = signal(false);
  private allEpisodes: HomepageEpisode[] = [];
  private visibleCount: number = 0;
  private hasStartedScrolling: boolean = false;
  protected podcastCount = signal<number | undefined>(undefined);
  protected isLoading = signal<boolean>(true);
  protected isInError = signal<boolean>(false);
  readonly Weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  readonly Month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

  protected homepage = signal<Homepage | undefined>(undefined);
  protected totalDuration = signal<string>("");
  readonly episodeCountBaseline = 80000;
  protected auth = inject(AuthServiceWrapper);
  protected isSignedIn = toSignal(this.auth.isSignedIn, { initialValue: false });
  readonly renderConfig = {
    initialBlockSize: 10,
    firstScrollBlockSize: 100,
    nearEndBlockSize: 100,
    nearEndThresholdPixels: 1200,
  };

  private siteService = inject(SiteService);
  private homepageService = inject(HomepageService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);
  private transferState = inject(TransferState);
  private featureSwitch = inject(FeatureSwtichService);
  private ssrInjected = inject(HOMEPAGE_SSR_DATA, { optional: true });

  ngOnInit() {
    this.trySeedFromSsr();
    this.populatePage();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (!this.homepage() || this.isLoading() || this.isInError() || this.allEpisodes.length === 0) {
      return;
    }

    if (!this.hasStartedScrolling && window.scrollY > 0) {
      this.hasStartedScrolling = true;
      this.loadMoreEpisodes(this.renderConfig.firstScrollBlockSize);
      return;
    }

    const currentBottom = window.innerHeight + window.scrollY;
    const documentHeight = document.documentElement.scrollHeight;
    const isNearEnd = currentBottom >= (documentHeight - this.renderConfig.nearEndThresholdPixels);

    if (isNearEnd) {
      this.loadMoreEpisodes(this.renderConfig.nearEndBlockSize);
    }
  }

  populatePage() {
    combineLatest(
      [this.route.params, this.route.queryParams],
      (params: Params, queryParams: Params) => ({
        params,
        queryParams,
      })
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(async () => {
      this.siteService.setQuery(null);
      this.siteService.setPodcast(null);
      this.siteService.setSubject(null);

      if (isPlatformServer(this.platformId)) {
        return;
      }

      let homepageContent: Homepage | undefined;
      try {
        homepageContent = await this.homepageService.getHomepageFromApi()
      } catch (error) {
        console.error(error);
        if (!this.homepage()) {
          this.isLoading.set(false);
          this.isInError.set(true);
        }
        return;
      }
      if (homepageContent) {
        this.applyApiHomepage(homepageContent);
      } else if (!this.homepage()) {
        this.isLoading.set(false);
        this.isInError.set(true);
      }
    });
  }

  private trySeedFromSsr(): void {
    if (!this.featureSwitch.IsEnabled(FeatureSwitch.homepageSsr)) {
      return;
    }

    let seed: PreProcessedHomepage | null = null;
    if (isPlatformServer(this.platformId) && this.ssrInjected) {
      seed = this.ssrInjected;
      this.transferState.set(HOMEPAGE_SSR_STATE_KEY, seed);
    } else if (isPlatformBrowser(this.platformId) && this.transferState.hasKey(HOMEPAGE_SSR_STATE_KEY)) {
      seed = this.transferState.get(HOMEPAGE_SSR_STATE_KEY, null as unknown as PreProcessedHomepage);
      this.transferState.remove(HOMEPAGE_SSR_STATE_KEY);
    }

    if (seed) {
      this.applySsrSeed(seed);
    }
  }

  private applySsrSeed(seed: PreProcessedHomepage): void {
    const byDay: { [key: string]: HomepageEpisode[] } = {};
    for (const [day, episodes] of Object.entries(seed.episodesByDay ?? {})) {
      byDay[day] = (episodes ?? []).map(item => this.normalizeEpisode(item));
    }

    this.useSsrDayLabels.set(true);
    this.grouped.set(byDay);
    this.podcastCount.set(seed.episodesThisWeek);
    this.totalDuration.set(`${seed.totalDurationDays} days`);
    this.homepage.set({
      recentEpisodes: Object.values(byDay).flat(),
      episodeCount: seed.episodeCount,
      totalDuration: `${seed.totalDurationDays}.00:00:00`
    });
    this.isLoading.set(false);
    this.isInError.set(false);
  }

  private applyApiHomepage(homepageContent: Homepage): void {
    this.useSsrDayLabels.set(false);
    this.homepage.set(homepageContent);
    this.totalDuration.set(homepageContent.totalDuration.split(".")[0] + " days");
    this.podcastCount.set(homepageContent.recentEpisodes.length);
    this.hasStartedScrolling = false;
    this.visibleCount = 0;
    this.allEpisodes = homepageContent.recentEpisodes.map(item => this.normalizeEpisode(item));
    this.loadMoreEpisodes(this.renderConfig.initialBlockSize);
    this.isLoading.set(false);
    this.isInError.set(false);
  }

  private normalizeEpisode(item: HomepageEpisode): HomepageEpisode {
    return {
      ...item,
      release: new Date(item.release)
    };
  }

  private loadMoreEpisodes(count: number): void {
    const nextVisibleCount = Math.min(this.visibleCount + count, this.allEpisodes.length);
    if (nextVisibleCount === this.visibleCount) {
      return;
    }

    this.visibleCount = nextVisibleCount;
    const visibleEpisodes = this.allEpisodes.slice(0, this.visibleCount);
    this.grouped.set(visibleEpisodes.reduce((group: { [key: string]: HomepageEpisode[] }, item) => {
      const releaseDate = item.release as Date;
      const releaseDateKey = releaseDate.toLocaleDateString();
      if (!group[releaseDateKey]) {
        group[releaseDateKey] = [];
      }
      group[releaseDateKey].push(item);
      return group;
    }, {}));
  }

  ToDate = (dateStr: string) => {
    const [day, month, year] = dateStr.split("/")
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }

  descDate = (a: KeyValue<string, HomepageEpisode[]>, b: KeyValue<string, HomepageEpisode[]>): number => {
    var aD = this.ToDate(a.key);
    var bD = this.ToDate(b.key);
    if (aD > bD) {
      return -1;
    }
    if (aD < bD) {
      return 1
    }
    return 0;
  }

  /** Preserve SSR day order by first episode release; for API locale keys use descDate. */
  daySort = (a: KeyValue<string, HomepageEpisode[]>, b: KeyValue<string, HomepageEpisode[]>): number => {
    if (this.useSsrDayLabels()) {
      const aRelease = a.value[0]?.release ? new Date(a.value[0].release).getTime() : 0;
      const bRelease = b.value[0]?.release ? new Date(b.value[0].release).getTime() : 0;
      return bRelease - aRelease;
    }
    return this.descDate(a, b);
  }
}
