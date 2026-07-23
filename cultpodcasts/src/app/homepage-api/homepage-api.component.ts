import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Homepage } from '../homepage.interface';
import { SiteService } from '../site.service';
import { KeyValue } from '@angular/common';
import { ActivatedRoute, Params, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { HomepageService } from '../homepage.service';
import { HomepageEpisode } from '../homepage-episode.interface';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { SlotMachineCounterComponent } from '../slot-machine-counter/slot-machine-counter.component';
import { SearchBarComponent } from '../search-bar/search-bar.component';
import { episodeImageUrl } from '../search-result-links';

export interface EpisodeRail {
  id: string;
  title: string;
  episodes: HomepageEpisode[];
}

@Component({
  selector: 'app-homepage-api',
  imports: [
    MatProgressBarModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    SlotMachineCounterComponent,
    SearchBarComponent
  ],
  templateUrl: './homepage-api.component.html',
  styleUrl: './homepage-api.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomepageApiComponent {
  protected grouped = signal<{ [key: string]: HomepageEpisode[] }>({});
  private allEpisodes: HomepageEpisode[] = [];
  private visibleCount: number = 0;
  private hasStartedScrolling: boolean = false;
  protected podcastCount = signal<number | undefined>(undefined);
  protected isLoading = signal<boolean>(true);
  protected isInError = signal<boolean>(false);
  readonly Weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  readonly Month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  protected homepage = signal<Homepage | undefined>(undefined);
  protected totalDuration = signal<string>('');
  readonly episodeCountBaseline = 80000;
  protected auth = inject(AuthServiceWrapper);
  protected isSignedIn = toSignal(this.auth.isSignedIn, { initialValue: false });
  readonly renderConfig = {
    initialBlockSize: 40,
    firstScrollBlockSize: 80,
    nearEndBlockSize: 80,
    nearEndThresholdPixels: 1200,
  };

  /** Flat list currently rendered (for featured + “New this week” rail). */
  private readonly allEpisodesVisible = computed(() => {
    const g = this.grouped();
    const keys = Object.keys(g).sort((a, b) => this.descDateKey(a, b));
    return keys.flatMap((k) => g[k]);
  });

  protected readonly featured = computed(() => this.allEpisodesVisible()[0] ?? undefined);
  protected readonly featuredImage = computed(() => {
    const ep = this.featured();
    return ep ? episodeImageUrl(ep)?.toString() : undefined;
  });
  protected readonly featuredDesc = computed(() => {
    const text = this.featured()?.episodeDescription ?? '';
    return text.length > 220 ? `${text.slice(0, 220).trim()}…` : text;
  });

  protected readonly rails = computed((): EpisodeRail[] => {
    const g = this.grouped();
    const keys = Object.keys(g).sort((a, b) => this.descDateKey(a, b));
    const dayRails: EpisodeRail[] = keys.map((key) => {
      const d = this.ToDate(key);
      return {
        id: key,
        title: `${this.Weekday[d.getDay()]} ${d.getDate()} ${this.Month[d.getMonth()]}`,
        episodes: g[key],
      };
    });
    const week = this.allEpisodesVisible();
    if (week.length === 0) {
      return dayRails;
    }
    return [
      { id: 'new-this-week', title: 'New this week', episodes: week },
      ...dayRails,
    ];
  });

  private siteService = inject(SiteService);
  private homepageService = inject(HomepageService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.siteService.homepageRefresh$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        void this.loadHomepage();
      });
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
    const isNearEnd = currentBottom >= documentHeight - this.renderConfig.nearEndThresholdPixels;

    if (isNearEnd) {
      this.loadMoreEpisodes(this.renderConfig.nearEndBlockSize);
    }
  }

  posterImage(episode: HomepageEpisode): string | undefined {
    return episodeImageUrl(episode)?.toString();
  }

  durationLabel(duration: string): string {
    return duration.startsWith('0') ? duration.substring(1) : duration;
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
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0 });
    }

    let homepageContent: Homepage | undefined;
    try {
      homepageContent = await this.homepageService.getHomepageFromApi();
    } catch (error) {
      console.error(error);
      this.isLoading.set(false);
      this.isInError.set(true);
      return;
    }

    if (homepageContent) {
      this.homepage.set(homepageContent);
      this.totalDuration.set(homepageContent.totalDuration.split('.')[0] + ' days');
      this.podcastCount.set(homepageContent.recentEpisodes.length);
      this.hasStartedScrolling = false;
      this.visibleCount = 0;
      this.allEpisodes = homepageContent.recentEpisodes.map((item) => ({
        ...item,
        release: new Date(item.release),
      }));
      this.loadMoreEpisodes(this.renderConfig.initialBlockSize);
      this.isLoading.set(false);
      this.isInError.set(false);
    } else {
      this.isLoading.set(false);
      this.isInError.set(true);
    }
  }

  private loadMoreEpisodes(count: number): void {
    const nextVisibleCount = Math.min(this.visibleCount + count, this.allEpisodes.length);
    if (nextVisibleCount === this.visibleCount) {
      return;
    }

    this.visibleCount = nextVisibleCount;
    const visibleEpisodes = this.allEpisodes.slice(0, this.visibleCount);
    this.grouped.set(
      visibleEpisodes.reduce((group: { [key: string]: HomepageEpisode[] }, item) => {
        const releaseDate = item.release as Date;
        const releaseDateKey = releaseDate.toLocaleDateString();
        if (!group[releaseDateKey]) {
          group[releaseDateKey] = [];
        }
        group[releaseDateKey].push(item);
        return group;
      }, {})
    );
  }

  ToDate = (dateStr: string) => {
    const [day, month, year] = dateStr.split('/');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  };

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
