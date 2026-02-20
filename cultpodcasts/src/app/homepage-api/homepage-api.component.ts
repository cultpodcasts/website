import { Component, HostListener, inject } from '@angular/core';
import { Homepage } from '../homepage.interface';
import { SiteService } from '../site.service';
import { KeyValue, DecimalPipe, KeyValuePipe } from '@angular/common';
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

@Component({
  selector: 'app-homepage-api',
  imports: [
    MatProgressBarModule,
    MatCardModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    DecimalPipe,
    KeyValuePipe,
    EpisodeImageComponent,
    EpisodeLinksComponent,
    BookmarkComponent,
    SubjectsComponent
  ],
  templateUrl: './homepage-api.component.html',
  styleUrl: './homepage-api.component.sass'
})
export class HomepageApiComponent {
  grouped: { [key: string]: HomepageEpisode[]; };
  allEpisodes: HomepageEpisode[] = [];
  visibleCount: number = 0;
  hasStartedScrolling: boolean = false;
  podcastCount: number | undefined;
  isLoading: boolean = true;
  isInError: boolean = false;
  Weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  Month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

  homepage: Homepage | undefined;
  totalDuration: string = "";
  isSignedIn: boolean = false;
  readonly renderConfig = {
    initialBlockSize: 10,
    firstScrollBlockSize: 100,
    nearEndBlockSize: 100,
    nearEndThresholdPixels: 1200,
  };

  constructor(
    private siteService: SiteService,
    private homepageService: HomepageService,
    protected auth: AuthServiceWrapper
  ) {
    this.grouped = {};
    this.auth.isSignedIn.subscribe(isSignedIn => this.isSignedIn = isSignedIn);
  }
  private route = inject(ActivatedRoute);

  ngOnInit() {
    this.populatePage();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (!this.homepage || this.isLoading || this.isInError || this.allEpisodes.length === 0) {
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
    ).subscribe(async (res: { params: Params; queryParams: Params }) => {
      const { params, queryParams } = res;

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
        this.isLoading = false;
        this.isInError = true;
      }
      if (homepageContent) {
        this.homepage = homepageContent;
        this.totalDuration = this.homepage.totalDuration.split(".")[0] + " days";
        this.podcastCount = this.homepage.recentEpisodes.length;
        this.hasStartedScrolling = false;
        this.visibleCount = 0;
        this.allEpisodes = this.homepage.recentEpisodes.map(item => ({
          ...item,
          release: new Date(item.release)
        }));
        this.loadMoreEpisodes(this.renderConfig.initialBlockSize);
        this.isLoading = false;
        this.isInError = false;
      } else {
        this.isLoading = false;
        this.isInError = true;
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
    this.grouped = visibleEpisodes.reduce((group: { [key: string]: HomepageEpisode[] }, item) => {
      const releaseDate = item.release as Date;
      const releaseDateKey = releaseDate.toLocaleDateString();
      if (!group[releaseDateKey]) {
        group[releaseDateKey] = [];
      }
      group[releaseDateKey].push(item);
      return group;
    }, {});
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
