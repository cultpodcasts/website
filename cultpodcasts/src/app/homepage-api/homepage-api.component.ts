import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Homepage } from '../homepage.interface';
import { SiteService } from '../site.service';
import { KeyValue, KeyValuePipe } from '@angular/common';
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

  ngOnInit() {
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
    ).subscribe(async (res: { params: Params; queryParams: Params }) => {
      this.siteService.setQuery(null);
      this.siteService.setPodcast(null);
      this.siteService.setSubject(null);

      let homepageContent: Homepage | undefined;
      try {
        if (!homepageContent) {
          homepageContent = await this.homepageService.getHomepageFromApi()
        }
      } catch (error) {
        console.error(error);
        this.isLoading.set(false);
        this.isInError.set(true);
      }
      if (homepageContent) {
        this.homepage.set(homepageContent);
        this.totalDuration.set(homepageContent.totalDuration.split(".")[0] + " days");
        this.podcastCount.set(homepageContent.recentEpisodes.length);
        this.hasStartedScrolling = false;
        this.visibleCount = 0;
        this.allEpisodes = homepageContent.recentEpisodes.map(item => ({
          ...item,
          release: new Date(item.release)
        }));
        this.loadMoreEpisodes(this.renderConfig.initialBlockSize);
        this.isLoading.set(false);
        this.isInError.set(false);
      } else {
        this.isLoading.set(false);
        this.isInError.set(true);
      }
    });
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
}
